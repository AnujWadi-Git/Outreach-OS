import { Mail, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ClipboardButton } from "@/components/campaigns/clipboard-button";
import { DraftEditorDialog } from "@/components/campaigns/draft-editor-dialog";
import { StatusBadge } from "@/components/campaigns/status-badge";

export type DraftPreview = {
  id: string;
  recipient: string;
  selectedSubject: string;
  subjectOptions: string[];
  body: string;
  followUp: string;
  hookSummary: string;
  confidence: number;
  status: string;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  contact: {
    fullName: string | null;
    title: string | null;
    company: string | null;
  };
};

function draftJson(draft: DraftPreview) {
  return JSON.stringify(
    {
      recipient: draft.recipient,
      subjectLineOptions: draft.subjectOptions,
      mainEmail: draft.body,
      followUpEmail: draft.followUp,
      hookSummary: draft.hookSummary,
      status: draft.status,
    },
    null,
    2
  );
}

function emailText(draft: DraftPreview) {
  return `To: ${draft.recipient}
Subject: ${draft.selectedSubject}

${draft.body}`;
}

export function DraftPreviewList({ drafts }: { drafts: DraftPreview[] }) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No generated drafts yet. Fix invalid contacts if needed, then re-run
        generation.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {drafts.map((draft) => (
        <Card key={draft.id}>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {draft.contact.fullName || draft.recipient}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.contact.title || "Title unknown"}
                  {draft.contact.company ? ` at ${draft.contact.company}` : ""}
                </p>
              </div>
              <StatusBadge status={draft.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ClipboardButton value={emailText(draft)} label="Copy email" />
              <ClipboardButton value={draftJson(draft)} label="Copy JSON" />
              <DraftEditorDialog
                draft={{
                  id: draft.id,
                  selectedSubject: draft.selectedSubject,
                  body: draft.body,
                  followUp: draft.followUp,
                  hookSummary: draft.hookSummary,
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Mail className="size-3.5" />
                Recipient
              </div>
              <p className="text-sm">{draft.recipient}</p>
            </section>
            <Separator />
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Subject line options
              </div>
              <div className="flex flex-wrap gap-2">
                {draft.subjectOptions.map((subject) => (
                  <Badge
                    key={subject}
                    variant={
                      subject === draft.selectedSubject ? "default" : "secondary"
                    }
                  >
                    {subject}
                  </Badge>
                ))}
              </div>
            </section>
            <Separator />
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <MessageSquareText className="size-3.5" />
                Main email
              </div>
              <div className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-sm leading-6">
                {draft.body}
              </div>
            </section>
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Follow-up email
              </div>
              <div className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-sm leading-6">
                {draft.followUp}
              </div>
            </section>
            <section className="space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Hook summary
              </div>
              <p className="text-sm leading-6">{draft.hookSummary}</p>
              <p className="text-xs text-muted-foreground">
                Confidence {Math.round(draft.confidence * 100)}%
                {draft.gmailDraftId ? ` / Gmail draft ${draft.gmailDraftId}` : ""}
                {draft.gmailMessageId ? ` / Message ${draft.gmailMessageId}` : ""}
              </p>
            </section>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
