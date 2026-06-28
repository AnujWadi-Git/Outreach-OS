import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { NewCampaignForm } from "@/components/campaigns/new-campaign-form";
import { StandaloneOutreachTool } from "@/components/campaigns/standalone-outreach-tool";
import {
  authBypassEnabled,
  getCurrentUser,
  getGmailConnection,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  if (
    authBypassEnabled ||
    process.env.STANDALONE_FRONTEND_ONLY === "true" ||
    !process.env.DATABASE_URL
  ) {
    return (
      <StandaloneOutreachTool reason="Practical mode is active, so campaign creation happens in the browser with local saves." />
    );
  }

  const user = await getCurrentUser();

  if (!user) redirect("/auth/signin");

  const [resumes, gmailConnection] = await Promise.all([
    prisma.resume.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { id: true, fileName: true, isDefault: true },
    }),
    getGmailConnection(user.id),
  ]);

  const gmailConnected = Boolean(gmailConnection?.refresh_token);

  return (
    <AppShell user={user} gmailConnected={gmailConnected}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase text-muted-foreground">
            New outreach workflow
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Create campaign</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The pipeline runs parse, JD analysis, matching, generation, and
            draft preparation from your pasted inputs. Gmail actions happen only
            from the review page.
          </p>
        </div>
        <NewCampaignForm resumes={resumes} gmailConnected={gmailConnected} />
      </div>
    </AppShell>
  );
}
