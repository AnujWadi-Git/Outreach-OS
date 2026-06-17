"use client";

import { useFormState } from "react-dom";
import { Pencil } from "lucide-react";
import { updateContactAction, type ActionState } from "@/app/actions";
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

type ContactEditorProps = {
  contact: {
    id: string;
    campaignId: string;
    fullName: string | null;
    email: string | null;
    title: string | null;
    company: string | null;
  };
};

const initialState: ActionState = { status: "idle" };

export function ContactEditorDialog({ contact }: ContactEditorProps) {
  const [state, formAction] = useFormState(updateContactAction, initialState);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>
            Correct parsed fields before rerunning generation or creating Gmail
            drafts.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="contactId" value={contact.id} />
          <input type="hidden" name="campaignId" value={contact.campaignId} />
          {state.message ? (
            <Alert variant={state.status === "error" ? "destructive" : "success"}>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`fullName-${contact.id}`}>Full name</Label>
              <Input
                id={`fullName-${contact.id}`}
                name="fullName"
                defaultValue={contact.fullName || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${contact.id}`}>Email</Label>
              <Input
                id={`email-${contact.id}`}
                name="email"
                type="email"
                defaultValue={contact.email || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`title-${contact.id}`}>Title</Label>
              <Input
                id={`title-${contact.id}`}
                name="title"
                defaultValue={contact.title || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`company-${contact.id}`}>Company</Label>
              <Input
                id={`company-${contact.id}`}
                name="company"
                defaultValue={contact.company || ""}
              />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton pendingLabel="Saving">Save contact</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
