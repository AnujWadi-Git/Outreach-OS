import Link from "next/link";
import { MailCheck, Plus, ShieldCheck } from "lucide-react";
import type { User } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { authBypassEnabled } from "@/lib/auth";

export function AppShell({
  user,
  gmailConnected,
  children,
}: {
  user: User;
  gmailConnected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="tool-shell min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MailCheck className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold leading-none">
                  Outreach OS
                </p>
                <p className="text-xs text-muted-foreground">
                  Cool Tools / recruiter workflow automation
                </p>
              </div>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {authBypassEnabled ? (
              <Badge variant="secondary">Open access mode</Badge>
            ) : null}
            <Badge variant={gmailConnected ? "success" : "warning"}>
              <ShieldCheck className="mr-1 size-3" />
              {gmailConnected ? "Gmail connected" : "Gmail needs consent"}
            </Badge>
            <Badge variant="secondary">{user.email}</Badge>
            <Button asChild size="sm">
              <Link href="/campaigns/new">
                <Plus />
                New campaign
              </Link>
            </Button>
            {!authBypassEnabled ? <SignOutButton /> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
