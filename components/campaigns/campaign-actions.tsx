import Link from "next/link";
import { Download, RefreshCcw, RotateCw, Send, Sparkles } from "lucide-react";
import {
  createDraftsAction,
  regenerateCampaignAction,
  resyncCampaignAction,
  sendCampaignAction,
} from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function CampaignActions({
  campaignId,
  mode,
  hasDrafts,
  hasResume,
}: {
  campaignId: string;
  mode: string;
  hasDrafts: boolean;
  hasResume: boolean;
}) {
  return (
    <div className="space-y-4">
      {!hasResume ? (
        <Alert variant="warning">
          <AlertTitle>No resume selected</AlertTitle>
          <AlertDescription>
            Drafts and sends can still run, but no PDF will be attached until a
            resume is selected on a new campaign or uploaded as default.
          </AlertDescription>
        </Alert>
      ) : null}
      {mode === "SEND" ? (
        <Alert variant="warning">
          <AlertTitle>Send mode enabled</AlertTitle>
          <AlertDescription>
            Direct send still requires typing SEND_NOW below. Draft mode remains
            the default workflow for new campaigns.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <form action={regenerateCampaignAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <SubmitButton variant="outline" pendingLabel="Regenerating">
            <Sparkles />
            Re-run generation
          </SubmitButton>
        </form>
        <form action={createDraftsAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <SubmitButton
            variant="default"
            pendingLabel="Creating drafts"
            disabled={!hasDrafts}
          >
            <RotateCw />
            Create Gmail drafts
          </SubmitButton>
        </form>
        <form action={resyncCampaignAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <SubmitButton variant="outline" pendingLabel="Resyncing">
            <RefreshCcw />
            Re-sync Gmail
          </SubmitButton>
        </form>
        <Button asChild variant="outline">
          <Link href={`/api/campaigns/${campaignId}/export?format=json`}>
            <Download />
            JSON
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/api/campaigns/${campaignId}/export?format=csv`}>
            <Download />
            CSV
          </Link>
        </Button>
      </div>
      <form
        action={sendCampaignAction}
        className="flex max-w-2xl flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="flex-1 space-y-2">
          <label htmlFor="confirmSend" className="text-sm font-medium">
            Direct send confirmation
          </label>
          <Input
            id="confirmSend"
            name="confirmSend"
            placeholder="Type SEND_NOW"
            autoComplete="off"
          />
        </div>
        <SubmitButton
          variant="destructive"
          pendingLabel="Sending"
          disabled={!hasDrafts}
        >
          <Send />
          Send emails
        </SubmitButton>
      </form>
    </div>
  );
}
