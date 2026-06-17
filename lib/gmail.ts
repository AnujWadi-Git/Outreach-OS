import crypto from "node:crypto";
import fs from "node:fs/promises";
import { google } from "googleapis";
import type { Draft, Resume } from "@prisma/client";
import { candidateProfile } from "@/lib/persona";
import { prisma } from "@/lib/prisma";

type DraftWithDelivery = Draft & {
  resume: Resume | null;
  contact: {
    id: string;
    email: string | null;
    isValid: boolean;
    fullName: string | null;
  };
};

type GmailActionResult = {
  draftId: string;
  contactId: string;
  status: "success" | "failed" | "skipped";
  gmailDraftId?: string | null;
  gmailMessageId?: string | null;
  error?: string;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function chunkBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") || value;
}

function encodeHeader(value: string) {
  const safe = value.replace(/[\r\n]/g, " ").trim();
  return /^[\x00-\x7F]*$/.test(safe)
    ? safe
    : `=?UTF-8?B?${Buffer.from(safe).toString("base64")}?=`;
}

function sanitizeAddress(value: string) {
  return value.replace(/[\r\n]/g, "").trim();
}

function shouldRetry(error: unknown) {
  const status = Number(
    (error as { code?: number; status?: number })?.code ||
      (error as { code?: number; status?: number })?.status
  );

  return status === 429 || status === 403 || status >= 500;
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === attempts) break;
      await new Promise((resolve) =>
        setTimeout(resolve, 700 * attempt + Math.random() * 300)
      );
    }
  }

  throw lastError;
}

async function getGmailClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token && !account?.refresh_token) {
    throw new Error("Gmail is not connected. Sign in with Google first.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token || undefined,
    refresh_token: account.refresh_token || undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token || account.access_token,
        refresh_token: tokens.refresh_token || account.refresh_token,
        expires_at: tokens.expiry_date
          ? Math.floor(tokens.expiry_date / 1000)
          : account.expires_at,
      },
    });
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

async function buildMimeMessage(draft: DraftWithDelivery) {
  if (!draft.contact.email || !draft.contact.isValid) {
    throw new Error("Skipping contact with missing or invalid email.");
  }

  const attachment = draft.resume
    ? {
        fileName: draft.resume.fileName,
        content: await fs.readFile(draft.resume.storagePath),
      }
    : null;

  const boundary = `outreach_os_${crypto.randomBytes(12).toString("hex")}`;
  const body = `${draft.body.trim()}

--
${candidateProfile.name}
${candidateProfile.email}
${candidateProfile.portfolio}
${candidateProfile.linkedIn}`;

  const lines = [
    `To: ${sanitizeAddress(draft.contact.email)}`,
    `From: ${encodeHeader(candidateProfile.name)} <${candidateProfile.email}>`,
    `Subject: ${encodeHeader(draft.selectedSubject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(Buffer.from(body, "utf8").toString("base64")),
  ];

  if (attachment) {
    lines.push(
      `--${boundary}`,
      `Content-Type: application/pdf; name="${encodeHeader(attachment.fileName)}"`,
      `Content-Disposition: attachment; filename="${encodeHeader(
        attachment.fileName
      )}"`,
      "Content-Transfer-Encoding: base64",
      "",
      chunkBase64(attachment.content.toString("base64"))
    );
  }

  lines.push(`--${boundary}--`, "");

  const mime = lines.join("\r\n");

  return {
    raw: base64Url(mime),
    hash: crypto.createHash("sha256").update(mime).digest("hex"),
  };
}

async function recordDelivery({
  campaignId,
  contactId,
  draftId,
  action,
  status,
  gmailDraftId,
  gmailMessageId,
  error,
  metadata,
}: {
  campaignId: string;
  contactId: string;
  draftId: string;
  action: "CREATE_DRAFT" | "SEND" | "RESYNC" | "RETRY";
  status: "PENDING" | "SUCCESS" | "FAILED" | "SKIPPED";
  gmailDraftId?: string | null;
  gmailMessageId?: string | null;
  error?: string;
  metadata?: unknown;
}) {
  return prisma.deliveryLog.create({
    data: {
      campaignId,
      contactId,
      draftId,
      action,
      status,
      gmailDraftId,
      gmailMessageId,
      error,
      metadata: metadata === undefined ? undefined : JSON.parse(JSON.stringify(metadata)),
    },
  });
}

async function getCampaignDrafts(userId: string, campaignId: string) {
  return prisma.draft.findMany({
    where: {
      campaign: {
        id: campaignId,
        userId,
      },
    },
    include: {
      resume: true,
      contact: {
        select: {
          id: true,
          email: true,
          isValid: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function updateCampaignCounts(campaignId: string) {
  const contacts = await prisma.contact.findMany({
    where: { campaignId },
    select: { status: true },
  });
  const failures = contacts.filter((contact) => contact.status === "FAILED");
  const successes = contacts.filter((contact) =>
    ["DRAFT_CREATED", "SENT"].includes(contact.status)
  );

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      successCount: successes.length,
      failureCount: failures.length,
      status:
        failures.length > 0 && successes.length > 0
          ? "PARTIAL"
          : failures.length > 0
            ? "FAILED"
            : contacts.some((contact) => contact.status === "SENT")
              ? "SENT"
              : contacts.some((contact) => contact.status === "DRAFT_CREATED")
                ? "DRAFTED"
                : undefined,
    },
  });
}

export async function createGmailDraftsForCampaign(
  userId: string,
  campaignId: string
) {
  const gmail = await getGmailClient(userId);
  const drafts = await getCampaignDrafts(userId, campaignId);
  const results: GmailActionResult[] = [];

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "DRAFTING", lastError: null },
  });

  for (const draft of drafts) {
    if (draft.gmailDraftId) {
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "skipped",
        gmailDraftId: draft.gmailDraftId,
        gmailMessageId: draft.gmailMessageId,
      });
      await recordDelivery({
        campaignId,
        contactId: draft.contactId,
        draftId: draft.id,
        action: "CREATE_DRAFT",
        status: "SKIPPED",
        gmailDraftId: draft.gmailDraftId,
        gmailMessageId: draft.gmailMessageId,
        metadata: { reason: "Draft already exists; idempotency guard skipped." },
      });
      continue;
    }

    try {
      const { raw, hash } = await buildMimeMessage(draft);
      const response = await withRetry(() =>
        gmail.users.drafts.create({
          userId: "me",
          requestBody: {
            message: { raw },
          },
        })
      );
      const gmailDraftId = response.data.id || null;
      const gmailMessageId = response.data.message?.id || null;

      await prisma.$transaction([
        prisma.draft.update({
          where: { id: draft.id },
          data: {
            status: "DRAFT_CREATED",
            gmailDraftId,
            gmailMessageId,
            mimeHash: hash,
          },
        }),
        prisma.contact.update({
          where: { id: draft.contactId },
          data: {
            status: "DRAFT_CREATED",
            gmailDraftId,
            gmailMessageId,
            lastError: null,
            attemptCount: { increment: 1 },
          },
        }),
      ]);
      await recordDelivery({
        campaignId,
        contactId: draft.contactId,
        draftId: draft.id,
        action: "CREATE_DRAFT",
        status: "SUCCESS",
        gmailDraftId,
        gmailMessageId,
      });
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "success",
        gmailDraftId,
        gmailMessageId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create Gmail draft.";
      await prisma.$transaction([
        prisma.draft.update({
          where: { id: draft.id },
          data: { status: "FAILED" },
        }),
        prisma.contact.update({
          where: { id: draft.contactId },
          data: {
            status: draft.contact.isValid ? "FAILED" : "SKIPPED",
            lastError: message,
            attemptCount: { increment: 1 },
          },
        }),
      ]);
      await recordDelivery({
        campaignId,
        contactId: draft.contactId,
        draftId: draft.id,
        action: "CREATE_DRAFT",
        status: "FAILED",
        error: message,
      });
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "failed",
        error: message,
      });
    }
  }

  await updateCampaignCounts(campaignId);
  return results;
}

export async function sendEmailsForCampaign({
  userId,
  campaignId,
  confirmed,
}: {
  userId: string;
  campaignId: string;
  confirmed: boolean;
}) {
  if (!confirmed) {
    throw new Error("Direct send requires explicit confirmation.");
  }

  const gmail = await getGmailClient(userId);
  const drafts = await getCampaignDrafts(userId, campaignId);
  const results: GmailActionResult[] = [];

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "SENDING", mode: "SEND", lastError: null },
  });

  for (const draft of drafts) {
    if (draft.gmailMessageId && draft.status === "SENT") {
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "skipped",
        gmailMessageId: draft.gmailMessageId,
      });
      continue;
    }

    try {
      const { raw, hash } = await buildMimeMessage(draft);
      const response = await withRetry(() =>
        gmail.users.messages.send({
          userId: "me",
          requestBody: { raw },
        })
      );
      const gmailMessageId = response.data.id || null;

      await prisma.$transaction([
        prisma.draft.update({
          where: { id: draft.id },
          data: {
            status: "SENT",
            gmailMessageId,
            mimeHash: hash,
          },
        }),
        prisma.contact.update({
          where: { id: draft.contactId },
          data: {
            status: "SENT",
            gmailMessageId,
            lastError: null,
            attemptCount: { increment: 1 },
          },
        }),
      ]);
      await recordDelivery({
        campaignId,
        contactId: draft.contactId,
        draftId: draft.id,
        action: "SEND",
        status: "SUCCESS",
        gmailMessageId,
      });
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "success",
        gmailMessageId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send email.";
      await prisma.$transaction([
        prisma.draft.update({
          where: { id: draft.id },
          data: { status: "FAILED" },
        }),
        prisma.contact.update({
          where: { id: draft.contactId },
          data: {
            status: draft.contact.isValid ? "FAILED" : "SKIPPED",
            lastError: message,
            attemptCount: { increment: 1 },
          },
        }),
      ]);
      await recordDelivery({
        campaignId,
        contactId: draft.contactId,
        draftId: draft.id,
        action: "SEND",
        status: "FAILED",
        error: message,
      });
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "failed",
        error: message,
      });
    }
  }

  await updateCampaignCounts(campaignId);
  return results;
}

export async function resyncGmailStatusForCampaign(
  userId: string,
  campaignId: string
) {
  const gmail = await getGmailClient(userId);
  const drafts = await getCampaignDrafts(userId, campaignId);
  const results: GmailActionResult[] = [];

  for (const draft of drafts) {
    try {
      if (draft.gmailDraftId) {
        const response = await withRetry(() =>
          gmail.users.drafts.get({
            userId: "me",
            id: draft.gmailDraftId || undefined,
          })
        );
        await recordDelivery({
          campaignId,
          contactId: draft.contactId,
          draftId: draft.id,
          action: "RESYNC",
          status: "SUCCESS",
          gmailDraftId: response.data.id,
          gmailMessageId: response.data.message?.id,
          metadata: { labelIds: response.data.message?.labelIds },
        });
        results.push({
          draftId: draft.id,
          contactId: draft.contactId,
          status: "success",
          gmailDraftId: response.data.id,
          gmailMessageId: response.data.message?.id,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resync Gmail status.";
      await recordDelivery({
        campaignId,
        contactId: draft.contactId,
        draftId: draft.id,
        action: "RESYNC",
        status: "FAILED",
        error: message,
      });
      results.push({
        draftId: draft.id,
        contactId: draft.contactId,
        status: "failed",
        error: message,
      });
    }
  }

  return results;
}
