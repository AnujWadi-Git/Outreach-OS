import Link from "next/link";
import type { Campaign, ContactStatus, Resume, User } from "@prisma/client";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FileText, MailPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/layout/app-shell";
import { StandaloneOutreachTool } from "@/components/campaigns/standalone-outreach-tool";
import {
  CampaignHistory,
  type CampaignHistoryItem,
} from "@/components/campaigns/campaign-history";
import { ResumePanel } from "@/components/campaigns/resume-panel";
import {
  authBypassEnabled,
  getCurrentUser,
  getGmailConnection,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function standaloneReason(error: unknown) {
  const message =
    error instanceof Error ? error.message : "The backend is not available.";

  if (/database|prisma|postgres|connect|DATABASE_URL/i.test(message)) {
    return "The database backend is not available on this deployment, so Outreach OS is running as a no-login frontend tool. Campaigns are saved in this browser until Postgres is connected.";
  }

  return "The backend is not available on this deployment, so Outreach OS is running as a no-login frontend tool. Campaigns are saved in this browser for now.";
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

type DashboardData =
  | {
      status: "standalone";
      reason: string;
    }
  | {
      status: "ready";
      user: User;
      gmailConnected: boolean;
      campaigns: Array<Campaign & { _count: { contacts: number; drafts: number } }>;
      resumes: Resume[];
      totals: Array<{ status: ContactStatus; _count: { status: number } }>;
    };

async function loadDashboardData(): Promise<DashboardData> {
  if (process.env.STANDALONE_FRONTEND_ONLY === "true" || !process.env.DATABASE_URL) {
    return {
      status: "standalone",
      reason:
        "Outreach OS is running as a no-login frontend tool. Campaigns are saved in this browser until the backend is connected.",
    };
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        status: "standalone",
        reason:
          "Login is skipped for this build, so Outreach OS is running as a frontend tool.",
      };
    }

    const [campaigns, resumes, gmailConnection, totals] = await Promise.all([
      prisma.campaign.findMany({
        where: { userId: user.id },
        include: {
          _count: {
            select: { contacts: true, drafts: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.resume.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      }),
      getGmailConnection(user.id),
      prisma.contact.groupBy({
        by: ["status"],
        where: { campaign: { userId: user.id } },
        _count: { status: true },
      }),
    ]);

    return {
      status: "ready",
      user,
      gmailConnected: Boolean(gmailConnection?.refresh_token),
      campaigns,
      resumes,
      totals,
    };
  } catch (error) {
    return {
      status: "standalone",
      reason: standaloneReason(error),
    };
  }
}

export default async function DashboardPage() {
  const data = await loadDashboardData();

  if (data.status === "standalone") {
    return <StandaloneOutreachTool reason={data.reason} />;
  }

  const failureCount = data.totals
    .filter((item) => item.status === "FAILED")
    .reduce((sum, item) => sum + item._count.status, 0);
  const sentCount = data.totals
    .filter((item) => item.status === "SENT")
    .reduce((sum, item) => sum + item._count.status, 0);

  const history: CampaignHistoryItem[] = data.campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    mode: campaign.mode,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    contacts: campaign._count.contacts,
    drafts: campaign._count.drafts,
    failures: campaign.failureCount,
  }));

  return (
    <AppShell user={data.user} gmailConnected={data.gmailConnected}>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-muted-foreground">
              Outreach command center
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Recruiter campaigns</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Parse raw contact dumps, generate tailored outreach, attach your
              default resume, and create Gmail drafts from one workflow.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/campaigns/new">
              <MailPlus />
              New campaign
            </Link>
          </Button>
        </section>

        {!data.gmailConnected ? (
          <Alert variant="warning">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {authBypassEnabled
                ? "Gmail is paused for this open build"
                : "Gmail is not fully connected"}
            </AlertTitle>
            <AlertDescription>
              {authBypassEnabled
                ? "Login is skipped for now, so campaigns run in dry-run mode. You can still parse contacts, analyze jobs, generate outreach, edit, copy, and export."
                : "Sign in with Google and grant Gmail compose/send access before creating drafts or sending. You can still create dry-run campaigns and generate outreach."}
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Campaigns"
            value={data.campaigns.length}
            icon={<MailPlus className="size-5 text-primary" />}
          />
          <StatCard
            label="Saved resumes"
            value={data.resumes.length}
            icon={<FileText className="size-5 text-primary" />}
          />
          <StatCard
            label="Sent"
            value={sentCount}
            icon={<CheckCircle2 className="size-5 text-success" />}
          />
          <StatCard
            label="Failures"
            value={failureCount}
            icon={<AlertTriangle className="size-5 text-destructive" />}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Campaign history</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search, reopen, export, resync, and retry past campaigns.
              </p>
            </div>
            <CampaignHistory campaigns={history} />
          </div>
          <ResumePanel resumes={data.resumes} />
        </section>
      </div>
    </AppShell>
  );
}
