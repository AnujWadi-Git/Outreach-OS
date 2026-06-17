"use client";

import { useFormState } from "react-dom";
import { FileText } from "lucide-react";
import { uploadResumeAction, type ActionState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type ResumeItem = {
  id: string;
  fileName: string;
  size: number;
  isDefault: boolean;
  createdAt: Date | string;
};

const initialState: ActionState = { status: "idle" };

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function ResumePanel({ resumes }: { resumes: ResumeItem[] }) {
  const [state, formAction] = useFormState(uploadResumeAction, initialState);
  const defaultResume = resumes.find((resume) => resume.isDefault);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default resume</CardTitle>
        <CardDescription>
          Saved once, attached automatically to Gmail drafts and sends.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-background p-4">
          {defaultResume ? (
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-secondary">
                <FileText className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {defaultResume.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(defaultResume.size)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No default resume yet. Upload a PDF before creating Gmail drafts.
            </p>
          )}
        </div>
        {state.message ? (
          <Alert variant={state.status === "error" ? "destructive" : "success"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <form action={formAction} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dashboardResume">Upload PDF</Label>
            <Input
              id="dashboardResume"
              name="resumeFile"
              type="file"
              accept="application/pdf"
              required
            />
          </div>
          <SubmitButton pendingLabel="Saving resume">Save default</SubmitButton>
        </form>
        {resumes.length > 1 ? (
          <Button type="button" variant="outline" className="w-full" disabled>
            {resumes.length} saved resumes available in campaign setup
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
