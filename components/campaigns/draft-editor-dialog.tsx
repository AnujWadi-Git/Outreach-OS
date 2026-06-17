"use client";

import { useFormState } from "react-dom";
import { Pencil } from "lucide-react";
import { updateDraftAction, type ActionState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";

type DraftEditorProps = {
  draft: {
    id: string;
    selectedSubject: string;
    body: string;
    followUp: string;
    hookSummary: string;
  };
};

const initialState: ActionState = { status: "idle" };

export function DraftEditorDialog({ draft }: DraftEditorProps) {
  const [state, formAction] = useFormState(updateDraftAction, initialState);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil />
          Edit email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit generated outreach</DialogTitle>
          <DialogDescription>
            Save changes before creating Gmail drafts. Existing Gmail IDs are
            cleared when the content changes.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="draftId" value={draft.id} />
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "success"}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`subject-${draft.id}`}>Selected subject</Label>
            <Input
              id={`subject-${draft.id}`}
              name="selectedSubject"
              defaultValue={draft.selectedSubject}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`body-${draft.id}`}>Main email</Label>
            <Textarea
              id={`body-${draft.id}`}
              name="body"
              className="min-h-72"
              defaultValue={draft.body}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`followUp-${draft.id}`}>Follow-up email</Label>
            <Textarea
              id={`followUp-${draft.id}`}
              name="followUp"
              className="min-h-40"
              defaultValue={draft.followUp}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`hook-${draft.id}`}>Hook summary</Label>
            <Textarea
              id={`hook-${draft.id}`}
              name="hookSummary"
              defaultValue={draft.hookSummary}
            />
          </div>
          <DialogFooter>
            <SubmitButton pendingLabel="Saving">Save draft</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
