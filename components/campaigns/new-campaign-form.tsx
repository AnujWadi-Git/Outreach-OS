"use client";

import {
  useActionState,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Clipboard, Loader2, Mail, Send, TestTube2 } from "lucide-react";
import { createCampaignAction, type ActionState } from "@/app/actions";
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
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/campaigns/status-badge";

type ResumeOption = {
  id: string;
  fileName: string;
  isDefault: boolean;
};

type ParsedContact = {
  fullName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  confidence: number;
  isValid: boolean;
  validityReason: string;
};

type ParsePreview = {
  contacts: ParsedContact[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  usedLLMFallback: boolean;
};

const initialState: ActionState = { status: "idle" };

function ModeOption({
  value,
  title,
  description,
  icon,
  defaultChecked,
}: {
  value: string;
  title: string;
  description: string;
  icon: ReactNode;
  defaultChecked?: boolean;
}) {
  return (
    <label className="group relative cursor-pointer">
      <input
        type="radio"
        name="mode"
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex min-h-24 flex-col gap-2 rounded-lg border bg-card p-3 transition-colors peer-checked:border-primary peer-checked:bg-primary/5">
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </span>
        <span className="text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

export function NewCampaignForm({ resumes }: { resumes: ResumeOption[] }) {
  const [state, formAction] = useActionState(
    createCampaignAction,
    initialState
  );
  const [rawContacts, setRawContacts] = useState("");
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultResume = resumes.find((resume) => resume.isDefault);
  const hasPreview = Boolean(preview);

  const previewSummary = useMemo(() => {
    if (!preview) return "No preview yet";
    return `${preview.validCount} valid, ${preview.invalidCount} needs review, ${preview.duplicateCount} duplicate skipped`;
  }, [preview]);

  async function previewContacts() {
    setPreviewError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/parse-contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawContacts }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Preview failed.");
        setPreview(data);
      } catch (error) {
        setPreview(null);
        setPreviewError(
          error instanceof Error ? error.message : "Could not parse contacts."
        );
      }
    });
  }

  async function pasteContacts() {
    const text = await navigator.clipboard.readText();
    setRawContacts((current) => (current ? `${current}\n${text}` : text));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
      <form action={formAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign setup</CardTitle>
            <CardDescription>
              Paste the job description and messy recruiter/contact source data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertTitle>Campaign could not be created</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Anthropic recruiter outreach - AI Engineer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rawJobDescription">Raw job description</Label>
              <Textarea
                id="rawJobDescription"
                name="rawJobDescription"
                className="min-h-72"
                placeholder="Paste the full JD here..."
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="rawContacts">Raw contacts</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={pasteContacts}
                >
                  <Clipboard />
                  Paste clipboard
                </Button>
              </div>
              <Textarea
                id="rawContacts"
                name="rawContacts"
                className="min-h-60"
                value={rawContacts}
                onChange={(event) => setRawContacts(event.target.value)}
                placeholder={"John Smith <john@company.com>\nLead Recruiter\nCompany"}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resume and delivery mode</CardTitle>
            <CardDescription>
              Draft mode is the default approval workflow. Send mode still
              requires a final confirmation on the campaign page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="resumeId">Saved resume</Label>
                <select
                  id="resumeId"
                  name="resumeId"
                  defaultValue={defaultResume?.id || "none"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="none">No saved resume selected</option>
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.fileName}
                      {resume.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resumeFile">Upload PDF resume</Label>
                <Input id="resumeFile" name="resumeFile" type="file" accept="application/pdf" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="makeDefaultResume"
                defaultChecked={resumes.length === 0}
                className="size-4 rounded border-input"
              />
              Save uploaded resume as default
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <ModeOption
                value="DRAFT"
                title="Draft"
                description="Create Gmail drafts for review. Default and safest."
                icon={<Mail className="size-4 text-primary" />}
                defaultChecked
              />
              <ModeOption
                value="DRY_RUN"
                title="Dry run"
                description="Generate everything without touching Gmail."
                icon={<TestTube2 className="size-4 text-amber-700" />}
              />
              <ModeOption
                value="SEND"
                title="Send"
                description="Enable direct send workflow after explicit confirmation."
                icon={<Send className="size-4 text-destructive" />}
              />
            </div>
            <Alert variant="warning">
              <AlertTitle>Approval step stays on by default</AlertTitle>
              <AlertDescription>
                Creating a send-mode campaign does not send email. The campaign
                detail page requires typing <strong>SEND_NOW</strong> before
                any direct send action runs.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={previewContacts}
                disabled={!rawContacts.trim() || isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : null}
                Preview contacts
              </Button>
              <SubmitButton pendingLabel="Parsing and generating">
                Create campaign
              </SubmitButton>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="space-y-6">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Parsing preview</CardTitle>
                <CardDescription>{previewSummary}</CardDescription>
              </div>
              {preview?.usedLLMFallback ? (
                <Badge variant="secondary">LLM fallback used</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {previewError ? (
              <Alert variant="destructive">
                <AlertTitle>Preview failed</AlertTitle>
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            ) : null}
            {!hasPreview && !previewError ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm leading-6 text-muted-foreground">
                Preview extracted recipients before creating the campaign. Rows
                missing valid email addresses will be flagged and skipped for
                Gmail actions.
              </div>
            ) : null}
            {preview ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.contacts.map((contact, index) => (
                    <TableRow key={`${contact.email || "missing"}-${index}`}>
                      <TableCell>
                        <div className="font-medium">
                          {contact.fullName || "Needs name"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.email || "No email found"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{contact.title || "Title unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          {contact.company || "Company unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge
                            status={contact.isValid ? "PARSED" : "NEEDS_REVIEW"}
                          />
                          <div className="text-xs text-muted-foreground">
                            {Math.round(contact.confidence * 100)}% confidence
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
