import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { googleOAuthConfigured, ownerEmail } from "@/lib/auth";

function maskSecret(value: string | undefined) {
  if (!value) return "Missing";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function AuthDebugPage() {
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const callbackUrl = `${nextAuthUrl.replace(
    /\/$/,
    ""
  )}/api/auth/callback/google`;

  return (
    <main className="tool-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>OAuth diagnostics</CardTitle>
          <CardDescription>
            Local Google sign-in configuration for Outreach OS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!googleOAuthConfigured ? (
            <Alert variant="destructive">
              <AlertTitle>Google OAuth is incomplete</AlertTitle>
              <AlertDescription>
                Add both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then
                restart the dev server.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-3 rounded-lg border bg-background p-4 text-sm">
            <div>
              <p className="font-medium">Configured</p>
              <p className="text-muted-foreground">
                {googleOAuthConfigured ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="font-medium">Owner email</p>
              <p className="break-all text-muted-foreground">{ownerEmail}</p>
            </div>
            <div>
              <p className="font-medium">GOOGLE_CLIENT_ID</p>
              <p className="break-all text-muted-foreground">
                {process.env.GOOGLE_CLIENT_ID || "Missing"}
              </p>
            </div>
            <div>
              <p className="font-medium">GOOGLE_CLIENT_SECRET</p>
              <p className="break-all text-muted-foreground">
                {maskSecret(process.env.GOOGLE_CLIENT_SECRET)}
              </p>
            </div>
            <div>
              <p className="font-medium">NEXTAUTH_URL</p>
              <p className="break-all text-muted-foreground">{nextAuthUrl}</p>
            </div>
            <div>
              <p className="font-medium">Google redirect URI</p>
              <p className="break-all text-muted-foreground">{callbackUrl}</p>
            </div>
          </div>
          <Alert variant="warning">
            <AlertTitle>What invalid_client means here</AlertTitle>
            <AlertDescription>
              If Google says the OAuth client was not found while this page
              shows a client ID, recopy the Client ID from Google Cloud using
              the copy icon, confirm the credential type is Web application, and
              make sure this redirect URI is saved exactly.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href="/auth/signin">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
