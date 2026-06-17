import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/layout/google-sign-in-button";
import { getCurrentUser, ownerEmail } from "@/lib/auth";

export default async function SignInPage() {
  const user = await getCurrentUser();

  if (user) redirect("/");

  return (
    <main className="tool-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Outreach OS</CardTitle>
          <CardDescription>
            Private recruiter outreach automation for Anuj Wadi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertTitle>Google permission notice</AlertTitle>
            <AlertDescription>
              This app requests Gmail compose, send, and mailbox metadata access
              so it can create drafts, attach your resume, send only after
              confirmation, and resync delivery state. Access is restricted to{" "}
              <strong>{ownerEmail}</strong>.
            </AlertDescription>
          </Alert>
          <GoogleSignInButton />
        </CardContent>
      </Card>
    </main>
  );
}
