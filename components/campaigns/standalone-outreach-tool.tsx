"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clipboard,
  Download,
  FileJson,
  MailCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { candidateProfile } from "@/lib/persona";
import { cn } from "@/lib/utils";

type StandaloneContact = {
  id: string;
  fullName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  sourceText: string;
  confidence: number;
  isValid: boolean;
  validityReason: string;
};

type StandaloneDraft = {
  contactId: string;
  recipient: string;
  subjectOptions: string[];
  selectedSubject: string;
  body: string;
  followUp: string;
  hookSummary: string;
  confidence: number;
  status: "generated";
};

type StandaloneAnalysis = {
  companyName: string | null;
  roleType: string;
  seniority: string;
  priorities: string[];
  skills: string[];
  painPoints: string[];
  keywords: string[];
};

type StandaloneCampaign = {
  id: string;
  name: string;
  createdAt: string;
  rawJobDescription: string;
  rawContacts: string;
  analysis: StandaloneAnalysis;
  contacts: StandaloneContact[];
  drafts: StandaloneDraft[];
};

const storageKey = "outreach-os-standalone-campaigns";
const selectedCampaignStorageKey = "outreach-os-standalone-selected-campaign";
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const titleWords = [
  "recruiter",
  "talent",
  "sourcer",
  "people",
  "hr",
  "hiring",
  "manager",
  "director",
  "partner",
  "coordinator",
  "specialist",
  "acquisition",
];
const knownSkills = [
  "LLM",
  "RAG",
  "AI agents",
  "multimodal AI",
  "FastAPI",
  "backend",
  "APIs",
  "cloud",
  "workflow automation",
  "machine learning",
  "computer vision",
  "robotics",
  "Python",
  "TypeScript",
  "React",
  "Next.js",
  "Postgres",
  "AWS",
  "GCP",
  "Azure",
];

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return compact(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function looksLikeName(value: string) {
  const cleaned = value.replace(/[^A-Za-z.'\-\s]/g, " ").trim();
  if (!cleaned || cleaned.length > 70 || /@|\d|https?:\/\//i.test(cleaned)) {
    return false;
  }
  const lower = cleaned.toLowerCase();
  if (titleWords.some((word) => lower.includes(word))) return false;
  const parts = compact(cleaned).split(/\s+/);
  return parts.length >= 2 && parts.length <= 5;
}

function validEmail(email: string | null) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function parseContacts(raw: string): StandaloneContact[] {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const seen = new Set<string>();
  const contacts: StandaloneContact[] = [];

  lines.forEach((line, index) => {
    const matches = [...line.matchAll(emailPattern)];
    emailPattern.lastIndex = 0;

    matches.forEach((match) => {
      const email = match[0].toLowerCase();
      if (seen.has(email)) return;
      seen.add(email);

      const windowLines = lines
        .slice(Math.max(0, index - 2), Math.min(lines.length, index + 3))
        .map(compact)
        .filter(Boolean);
      const prefix = line.slice(0, Math.max(0, line.indexOf(match[0])));
      const angleName = line.match(/([^<>]{2,90})<\s*[A-Z0-9._%+-]+@/i)?.[1];
      const nameCandidate =
        angleName ||
        prefix ||
        windowLines.find((candidate) => !candidate.includes("@") && looksLikeName(candidate)) ||
        "";
      const fullName = looksLikeName(nameCandidate)
        ? titleCase(nameCandidate.replace(/[<>()"']/g, " "))
        : null;
      const title =
        windowLines.find((candidate) =>
          titleWords.some((word) => candidate.toLowerCase().includes(word))
        ) || null;
      const company =
        windowLines.find((candidate) => {
          if (candidate.includes("@")) return false;
          if (candidate === title || candidate === fullName) return false;
          if (looksLikeName(candidate)) return false;
          return candidate.length <= 120;
        }) || null;
      const isValid = validEmail(email);
      const confidence =
        (isValid ? 0.45 : 0) +
        (fullName ? 0.25 : 0) +
        (title ? 0.15 : 0) +
        (company ? 0.1 : 0.05);

      contacts.push({
        id: `${email}-${contacts.length}`,
        fullName,
        email,
        title,
        company,
        sourceText: windowLines.join("\n"),
        confidence: Number(Math.min(confidence, 0.98).toFixed(2)),
        isValid,
        validityReason: isValid
          ? fullName
            ? "Ready for outreach."
            : "Email is valid, name needs review."
          : "Missing or invalid email.",
      });
    });
  });

  return contacts;
}

function analyzeJob(raw: string): StandaloneAnalysis {
  const lower = raw.toLowerCase();
  const skills = knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
  const companyName =
    raw.match(/company\s*[:\-]\s*([^\n]{2,80})/i)?.[1]?.trim() ||
    raw.match(/at\s+([A-Z][A-Za-z0-9&.,' -]{2,60})\s+(?:is|we are|seeks|looking)/)?.[1]?.trim() ||
    null;
  const roleType =
    raw.match(
      /(senior|staff|principal|lead|entry[- ]level|junior)?\s*(ai|machine learning|software|full[- ]stack|backend|robotics|automation)\s+engineer/i
    )?.[0] ||
    raw
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 5 && line.length < 90) ||
    "AI Engineer";
  const seniority = /principal/i.test(raw)
    ? "Principal"
    : /staff/i.test(raw)
      ? "Staff"
      : /senior|sr\./i.test(raw)
        ? "Senior"
        : /junior|entry[- ]level|new grad/i.test(raw)
          ? "Early career"
          : "Mid-level or unspecified";
  const keywords = skills.length > 0 ? skills : candidateProfile.coreTechnicalAreas.slice(0, 5);

  return {
    companyName,
    roleType: compact(roleType),
    seniority,
    priorities: [
      "Ship reliable AI systems",
      "Connect technical work to practical business outcomes",
      "Find builders who can move from prototype to production",
    ],
    skills: keywords,
    painPoints: [
      "Turning AI ideas into usable products",
      "Integrating models with data, APIs, and workflows",
      "Reducing manual work with dependable automation",
    ],
    keywords,
  };
}

function firstName(name: string | null) {
  return name?.split(/\s+/)[0] || "there";
}

function buildDraft(contact: StandaloneContact, analysis: StandaloneAnalysis): StandaloneDraft {
  const company = contact.company || analysis.companyName || "your team";
  const skills = analysis.keywords.slice(0, 4).join(", ");
  const role = analysis.roleType || "AI engineering";
  const subjectOptions = [
    `${role} interest - Anuj Wadi`,
    `${skills} background for ${company}`,
    `AI systems builder for ${company}`,
  ];
  const body = `Hi ${firstName(contact.fullName)},

I came across the ${role} opportunity${company !== "your team" ? ` with ${company}` : ""} and wanted to reach out directly. The role stood out because it seems focused on practical AI systems, not just model experimentation, and that is where my background is strongest.

I am finishing my MS in Robotics and Autonomous Systems at Arizona State University with an AI focus, and I have been building across ${skills}. My work is especially aligned with connecting AI capability to reliable APIs, workflows, and tools that people can actually use.

I attached my resume for context. If this role is still active, I would be glad to share how my AI systems, automation, and robotics background could be useful for the team.

Best,
Anuj Wadi`;
  const followUp = `Hi ${firstName(contact.fullName)},

Just wanted to follow up on my note about the ${role} opportunity${company !== "your team" ? ` at ${company}` : ""}. The combination of ${skills} and practical product delivery is closely aligned with the AI systems work I have been building.

Happy to send more context or speak if the team is still reviewing candidates.

Best,
Anuj`;

  return {
    contactId: contact.id,
    recipient: contact.email || "",
    subjectOptions,
    selectedSubject: subjectOptions[0],
    body,
    followUp,
    hookSummary: `Positions Anuj as a practical AI systems builder for ${role}, mirroring ${skills} and tying his robotics AI background to the team's likely execution needs.`,
    confidence: contact.confidence,
    status: "generated",
  };
}

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function loadStoredCampaigns() {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as StandaloneCampaign[]) : [];
  } catch {
    return [];
  }
}

function loadSelectedCampaignId() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(selectedCampaignStorageKey);
  } catch {
    return null;
  }
}

export function StandaloneOutreachTool({ reason }: { reason?: string }) {
  const [name, setName] = useState("Recruiter outreach campaign");
  const [jobDescription, setJobDescription] = useState("");
  const [rawContacts, setRawContacts] = useState("");
  const [campaigns, setCampaigns] =
    useState<StandaloneCampaign[]>(loadStoredCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    loadSelectedCampaignId
  );

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      window.localStorage.setItem(selectedCampaignStorageKey, selectedCampaignId);
    } else {
      window.localStorage.removeItem(selectedCampaignStorageKey);
    }
  }, [selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) || campaigns[0],
    [campaigns, selectedCampaignId]
  );
  const activeCampaignId = selectedCampaign?.id || selectedCampaignId;

  const previewContacts = useMemo(() => parseContacts(rawContacts), [rawContacts]);

  function generateCampaign() {
    const analysis = analyzeJob(jobDescription);
    const contacts = parseContacts(rawContacts);
    const drafts = contacts
      .filter((contact) => contact.isValid && contact.email)
      .map((contact) => buildDraft(contact, analysis));
    const campaign: StandaloneCampaign = {
      id: window.crypto.randomUUID(),
      name: name.trim() || "Recruiter outreach campaign",
      createdAt: new Date().toISOString(),
      rawJobDescription: jobDescription,
      rawContacts,
      analysis,
      contacts,
      drafts,
    };
    setCampaigns((current) => [campaign, ...current].slice(0, 12));
    setSelectedCampaignId(campaign.id);
  }

  function updateSelectedCampaign(
    updater: (campaign: StandaloneCampaign) => StandaloneCampaign
  ) {
    setCampaigns((current) =>
      current.map((campaign) =>
        campaign.id === activeCampaignId ? updater(campaign) : campaign
      )
    );
  }

  function updateCampaignName(nextName: string) {
    updateSelectedCampaign((campaign) => ({ ...campaign, name: nextName }));
  }

  function updateDraftField(
    contactId: string,
    field: keyof Pick<
      StandaloneDraft,
      "selectedSubject" | "body" | "followUp" | "hookSummary"
    >,
    value: string
  ) {
    updateSelectedCampaign((campaign) => ({
      ...campaign,
      drafts: campaign.drafts.map((draft) =>
        draft.contactId === contactId ? { ...draft, [field]: value } : draft
      ),
    }));
  }

  function exportJson(campaign: StandaloneCampaign) {
    downloadFile(
      `${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`,
      JSON.stringify(campaign, null, 2),
      "application/json"
    );
  }

  function exportCsv(campaign: StandaloneCampaign) {
    const rows = [
      [
        "name",
        "email",
        "title",
        "company",
        "subject",
        "main_email",
        "follow_up",
        "hook_summary",
        "status",
      ],
      ...campaign.contacts.map((contact) => {
        const draft = campaign.drafts.find((item) => item.contactId === contact.id);
        return [
          contact.fullName,
          contact.email,
          contact.title,
          contact.company,
          draft?.selectedSubject,
          draft?.body,
          draft?.followUp,
          draft?.hookSummary,
          draft?.status || contact.validityReason,
        ];
      }),
    ];
    downloadFile(
      `${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`,
      rows.map((row) => row.map(csvCell).join(",")).join("\n"),
      "text/csv"
    );
  }

  async function copyJson(campaign: StandaloneCampaign) {
    await navigator.clipboard.writeText(JSON.stringify(campaign, null, 2));
  }

  return (
    <div className="tool-shell min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MailCheck className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold leading-none">Outreach OS</p>
              <p className="text-xs text-muted-foreground">
                Cool Tools / no-login frontend mode
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Frontend mode</Badge>
            <Badge variant="warning">Gmail paused</Badge>
            <Badge variant="success">Runs without login</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-muted-foreground">
              Outreach command center
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Recruiter outreach generator
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Paste a JD and messy contacts, then generate recruiter-ready
              outreach in Anuj&apos;s fixed format. Gmail and login can be added
              back after OAuth is fixed.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-2xl font-semibold">{campaigns.length}</p>
              <p className="text-xs text-muted-foreground">Campaigns</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-2xl font-semibold">{previewContacts.length}</p>
              <p className="text-xs text-muted-foreground">Parsed</p>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-2xl font-semibold">
                {previewContacts.filter((contact) => contact.isValid).length}
              </p>
              <p className="text-xs text-muted-foreground">Valid</p>
            </div>
          </div>
        </section>

        {reason ? (
          <Alert variant="warning">
            <AlertTitle>Backend skipped</AlertTitle>
            <AlertDescription>{reason}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Campaign setup</CardTitle>
              <CardDescription>
                This mode stores campaign history in this browser.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="standalone-name">Campaign name</Label>
                <Input
                  id="standalone-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="standalone-jd">Raw job description</Label>
                <Textarea
                  id="standalone-jd"
                  className="min-h-64"
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder="Paste the full JD here..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="standalone-contacts">Raw contacts</Label>
                <Textarea
                  id="standalone-contacts"
                  className="min-h-52"
                  value={rawContacts}
                  onChange={(event) => setRawContacts(event.target.value)}
                  placeholder={"John Smith <john@company.com>\nLead Recruiter\nCompany"}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={generateCampaign}
                  disabled={!jobDescription.trim() || !rawContacts.trim()}
                >
                  <Sparkles />
                  Generate outreach
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCampaigns([]);
                    setSelectedCampaignId(null);
                  }}
                  disabled={campaigns.length === 0}
                >
                  <Trash2 />
                  Clear local history
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Parsing preview</CardTitle>
                <CardDescription>
                  {previewContacts.length === 0
                    ? "No contacts detected yet"
                    : `${previewContacts.filter((contact) => contact.isValid).length} valid of ${previewContacts.length}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewContacts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Valid emails will appear here before generation.
                  </div>
                ) : (
                  previewContacts.slice(0, 8).map((contact) => (
                    <div key={contact.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {contact.fullName || "Name needs review"}
                          </p>
                          <p className="text-muted-foreground">{contact.email}</p>
                        </div>
                        <Badge variant={contact.isValid ? "success" : "warning"}>
                          {Math.round(contact.confidence * 100)}%
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[contact.title, contact.company].filter(Boolean).join(" / ") ||
                          contact.validityReason}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Local campaign history</CardTitle>
                <CardDescription>Saved in browser storage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No local campaigns yet.</p>
                ) : (
                  campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-secondary",
                        selectedCampaign?.id === campaign.id && "border-primary bg-primary/5"
                      )}
                    >
                      <p className="font-medium">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.contacts.length} contacts / {campaign.drafts.length} drafts
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {selectedCampaign ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">
                  Selected campaign
                </Label>
                <Input
                  value={selectedCampaign.name}
                  onChange={(event) => updateCampaignName(event.target.value)}
                  className="mt-2 max-w-xl text-xl font-semibold"
                />
                <p className="text-sm text-muted-foreground">
                  {selectedCampaign.analysis.roleType} /{" "}
                  {selectedCampaign.analysis.companyName || "Company unknown"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyJson(selectedCampaign)}
                >
                  <Clipboard />
                  Copy JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportJson(selectedCampaign)}
                >
                  <FileJson />
                  JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportCsv(selectedCampaign)}
                >
                  <Download />
                  CSV
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>JD analysis</CardTitle>
                <CardDescription>
                  Role, priorities, pain points, and mirrored keywords.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <p className="font-medium">Priorities</p>
                  <ul className="mt-2 list-inside list-disc text-muted-foreground">
                    {selectedCampaign.analysis.priorities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Pain points</p>
                  <ul className="mt-2 list-inside list-disc text-muted-foreground">
                    {selectedCampaign.analysis.painPoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Keywords</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCampaign.analysis.keywords.map((item) => (
                      <Badge key={item} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {selectedCampaign.drafts.map((draft) => (
                <Card key={draft.contactId}>
                  <CardHeader>
                    <CardTitle className="text-base">{draft.recipient}</CardTitle>
                    <CardDescription>{draft.hookSummary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm leading-6">
                    <div>
                      <p className="font-medium">Subject line options</p>
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {draft.subjectOptions.map((subject) => (
                            <Badge key={subject} variant="secondary">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                        <Input
                          value={draft.selectedSubject}
                          onChange={(event) =>
                            updateDraftField(
                              draft.contactId,
                              "selectedSubject",
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium">Main email</p>
                      <Textarea
                        className="mt-2 min-h-44 whitespace-pre-wrap"
                        value={draft.body}
                        onChange={(event) =>
                          updateDraftField(draft.contactId, "body", event.target.value)
                        }
                      />
                    </div>
                    <Separator />
                    <div>
                      <p className="font-medium">Follow-up email</p>
                      <Textarea
                        className="mt-2 min-h-36 whitespace-pre-wrap"
                        value={draft.followUp}
                        onChange={(event) =>
                          updateDraftField(
                            draft.contactId,
                            "followUp",
                            event.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <p className="font-medium">Hook summary</p>
                      <Textarea
                        className="mt-2 min-h-24"
                        value={draft.hookSummary}
                        onChange={(event) =>
                          updateDraftField(
                            draft.contactId,
                            "hookSummary",
                            event.target.value
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="success">generated</Badge>
                      <Badge variant="outline">
                        {Math.round(draft.confidence * 100)}% contact confidence
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            [draft.selectedSubject, "", draft.body, "", draft.followUp].join(
                              "\n"
                            )
                          )
                        }
                      >
                        <Clipboard />
                        Copy email
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
