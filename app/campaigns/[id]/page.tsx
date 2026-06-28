import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Mail, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppShell } from "@/components/layout/app-shell";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import {
  DraftPreviewList,
  type DraftPreview,
} from "@/components/campaigns/draft-preview-list";
import { ParsedContactsTable } from "@/components/campaigns/parsed-contacts-table";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { StandaloneOutreachTool } from "@/components/campaigns/standalone-outreach-tool";
import {
  authBypassEnabled,
  getCurrentUser,
  getGmailConnection,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function analysisList(value: unknown, key: string) {
  if (!value || typeof value !== "object") return [];
  const maybe = (value as Record<string, unknown>)[key];
  return asStringArray(maybe);
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (
    authBypassEnabled ||
    process.env.STANDALONE_FRONTEND_ONLY === "true" ||
    !process.env.DATABASE_URL
  ) {
    return (
      <StandaloneOutreachTool reason="Practical mode is active, so campaign detail lives in the browser with local persistence." />
    );
  }

  const user = await getCurrentUser();

  if (!user) redirect("/auth/signin");

  const { id } = await params;

  const [campaign, gmailConnection] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id, userId: user.id },
      include: {
        resume: true,
        jobDescription: true,
        contacts: {
          orderBy: { createdAt: "asc" },
        },
        drafts: {
          include: {
            contact: {
              select: {
                fullName: true,
                title: true,
                company: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        generationLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        deliveryLogs: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
      },
    }),
    getGmailConnection(user.id),
  ]);

  if (!campaign) notFound();

  const validContacts = campaign.contacts.filter((contact) => contact.isValid);
  const completedContacts = campaign.contacts.filter((contact) =>
    ["DRAFT_CREATED", "SENT"].includes(contact.status)
  );
  const failedContacts = campaign.contacts.filter((contact) =>
    ["FAILED", "NEEDS_REVIEW"].includes(contact.status)
  );
  const progress =
    validContacts.length > 0
      ? Math.round((completedContacts.length / validContacts.length) * 100)
      : 0;
  const analysis = campaign.jobDescription?.analysis;
  const gmailConnected = Boolean(gmailConnection?.refresh_token);
  const draftPreviews: DraftPreview[] = campaign.drafts.map((draft) => ({
    id: draft.id,
    recipient: draft.recipient,
    selectedSubject: draft.selectedSubject,
    subjectOptions: asStringArray(draft.subjectOptions),
    body: draft.body,
    followUp: draft.followUp,
    hookSummary: draft.hookSummary,
    confidence: draft.confidence,
    status: draft.status,
    gmailDraftId: draft.gmailDraftId,
    gmailMessageId: draft.gmailMessageId,
    contact: draft.contact,
  }));

  return (
    <AppShell
      user={user}
      gmailConnected={gmailConnected}
    >
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
              <StatusBadge status={campaign.mode} />
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{campaign.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Created {formatDateTime(campaign.createdAt)} / Updated{" "}
              {formatDateTime(campaign.updatedAt)}
            </p>
          </div>
          <div className="w-full max-w-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gmail progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        </section>

        {campaign.lastError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Campaign warning</AlertTitle>
            <AlertDescription>{campaign.lastError}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Parsed contacts"
            value={campaign.contacts.length}
            icon={<Users className="size-5 text-primary" />}
          />
          <StatCard
            label="Valid recipients"
            value={validContacts.length}
            icon={<CheckCircle2 className="size-5 text-success" />}
          />
          <StatCard
            label="Generated drafts"
            value={campaign.drafts.length}
            icon={<Mail className="size-5 text-primary" />}
          />
          <StatCard
            label="Needs attention"
            value={failedContacts.length}
            icon={<AlertCircle className="size-5 text-destructive" />}
          />
        </section>

        <CampaignActions
          campaignId={campaign.id}
          mode={campaign.mode}
          hasDrafts={campaign.drafts.length > 0}
          hasResume={Boolean(campaign.resume)}
          gmailConnected={gmailConnected}
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>JD analysis</CardTitle>
              <CardDescription>
                Structured role analysis used by the generation pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6">
              <div>
                <p className="font-medium">Role</p>
                <p className="text-muted-foreground">
                  {campaign.jobDescription?.roleType || "Unknown"} /{" "}
                  {campaign.jobDescription?.seniority || "Unspecified"}
                </p>
              </div>
              <div>
                <p className="font-medium">Company priorities</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {analysisList(analysis, "companyPriorities").map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Keywords to mirror</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysisList(analysis, "keywordsToMirror").map((item) => (
                    <span
                      key={item}
                      className="rounded-md bg-secondary px-2 py-1 text-xs"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Campaign source</CardTitle>
              <CardDescription>
                Stored raw inputs and resume selected for this run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6">
              <div>
                <p className="font-medium">Resume attachment</p>
                <p className="text-muted-foreground">
                  {campaign.resume?.fileName || "No resume selected"}
                </p>
              </div>
              <div>
                <p className="font-medium">Likely pain points</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {analysisList(analysis, "likelyPainPoints").map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Parsed contacts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Invalid or missing emails are visible here and skipped by Gmail
              actions until corrected.
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              <ParsedContactsTable
                contacts={campaign.contacts.map((contact) => ({
                  id: contact.id,
                  campaignId: campaign.id,
                  fullName: contact.fullName,
                  email: contact.email,
                  title: contact.title,
                  company: contact.company,
                  confidence: contact.confidence,
                  isValid: contact.isValid,
                  validityReason: contact.validityReason,
                  status: contact.status,
                  lastError: contact.lastError,
                }))}
              />
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Generated outreach</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every recipient follows the fixed format: recipient, subject
              options, main email, follow-up, hook summary, and status.
            </p>
          </div>
          <DraftPreviewList drafts={draftPreviews} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent generation logs</CardTitle>
              <CardDescription>OpenAI or fallback generation audit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.generationLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs yet.</p>
              ) : (
                campaign.generationLogs.map((log) => (
                  <div key={log.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={log.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {log.provider} / {log.model}
                      {log.error ? ` / ${log.error}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent delivery logs</CardTitle>
              <CardDescription>Gmail draft/send/resync responses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.deliveryLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Gmail actions yet.</p>
              ) : (
                campaign.deliveryLogs.map((log) => (
                  <div key={log.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={log.status} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {log.action}
                      {log.gmailDraftId ? ` / draft ${log.gmailDraftId}` : ""}
                      {log.gmailMessageId ? ` / message ${log.gmailMessageId}` : ""}
                      {log.error ? ` / ${log.error}` : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
