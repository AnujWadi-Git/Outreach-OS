import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { getCampaignExport } from "@/lib/campaign-export";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function campaignToCsv(campaign: Awaited<ReturnType<typeof getCampaignExport>>) {
  const rows = [
    [
      "name",
      "email",
      "title",
      "company",
      "status",
      "selected_subject",
      "main_email",
      "follow_up",
      "hook_summary",
      "gmail_draft_id",
      "gmail_message_id",
      "last_error",
    ],
    ...campaign.contacts.map((contact) => [
      contact.fullName,
      contact.email,
      contact.title,
      contact.company,
      contact.status,
      contact.draft?.selectedSubject,
      contact.draft?.body,
      contact.draft?.followUp,
      contact.draft?.hookSummary,
      contact.gmailDraftId,
      contact.gmailMessageId,
      contact.lastError,
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const { id } = await params;
    const campaign = await getCampaignExport(user.id, id);

    if (format === "csv") {
      return new Response(campaignToCsv(campaign), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="outreach-os-${campaign.id}.csv"`,
        },
      });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export campaign.",
      },
      { status: 500 }
    );
  }
}
