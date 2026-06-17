import type { CampaignMode, Prisma } from "@prisma/client";
import { analyzeJobDescription, type JobAnalysis } from "@/lib/jd-analysis";
import { generateOutreachForContact } from "@/lib/generation";
import { parseContactsWithFallback, isValidEmail } from "@/lib/parser";
import { prisma } from "@/lib/prisma";
import { getDefaultResume } from "@/lib/resume-storage";

export type CreateCampaignInput = {
  userId: string;
  name: string;
  rawJobDescription: string;
  rawContacts: string;
  mode: CampaignMode;
  resumeId?: string | null;
};

type SerializableJson = Prisma.InputJsonValue;

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as SerializableJson;
}

function contactStatus(isValid: boolean) {
  return isValid ? "PARSED" : "NEEDS_REVIEW";
}

function selectedSubject(options: string[]) {
  return options[0] || "Following up on your role";
}

async function ensureCampaignOwner(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      jobDescription: true,
      contacts: { orderBy: { createdAt: "asc" } },
      resume: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  return campaign;
}

export async function createCampaignFromInput(input: CreateCampaignInput) {
  if (!input.name.trim()) throw new Error("Campaign name is required.");
  if (!input.rawJobDescription.trim()) {
    throw new Error("Job description is required.");
  }
  if (!input.rawContacts.trim()) throw new Error("Contact text is required.");

  const resume =
    input.resumeId === "none"
      ? null
      : input.resumeId
        ? await prisma.resume.findFirst({
            where: { id: input.resumeId, userId: input.userId },
          })
        : await getDefaultResume(input.userId);

  const parsed = await parseContactsWithFallback(input.rawContacts);

  const campaign = await prisma.campaign.create({
    data: {
      userId: input.userId,
      resumeId: resume?.id,
      name: input.name.trim(),
      mode: input.mode,
      status: "PARSED",
      rawJobDescription: input.rawJobDescription,
      rawContacts: input.rawContacts,
      parsedContacts: asJson(parsed),
      contacts: {
        create: parsed.contacts.map((contact) => ({
          fullName: contact.fullName,
          email: contact.email,
          title: contact.title,
          company: contact.company,
          sourceText: contact.sourceText,
          confidence: contact.confidence,
          isValid: contact.isValid,
          validityReason: contact.validityReason,
          status: contactStatus(contact.isValid),
          parsedData: asJson(contact),
        })),
      },
    },
  });

  await analyzeAndStoreJobDescription({
    userId: input.userId,
    campaignId: campaign.id,
  });
  await generateCampaignOutreach({
    userId: input.userId,
    campaignId: campaign.id,
  });

  return prisma.campaign.findUniqueOrThrow({
    where: { id: campaign.id },
    include: {
      contacts: true,
      drafts: true,
      jobDescription: true,
      resume: true,
    },
  });
}

export async function analyzeAndStoreJobDescription({
  userId,
  campaignId,
}: {
  userId: string;
  campaignId: string;
}) {
  const campaign = await ensureCampaignOwner(userId, campaignId);
  const startedInput = { rawJobDescription: campaign.rawJobDescription };

  try {
    const result = await analyzeJobDescription(campaign.rawJobDescription);

    await prisma.$transaction([
      prisma.jobDescription.upsert({
        where: { campaignId },
        update: {
          rawText: campaign.rawJobDescription,
          companyName: result.analysis.companyName,
          roleType: result.analysis.roleType,
          seniority: result.analysis.seniority,
          analysis: asJson(result.analysis),
        },
        create: {
          campaignId,
          rawText: campaign.rawJobDescription,
          companyName: result.analysis.companyName,
          roleType: result.analysis.roleType,
          seniority: result.analysis.seniority,
          analysis: asJson(result.analysis),
        },
      }),
      prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "ANALYZED", lastError: null },
      }),
      prisma.generationLog.create({
        data: {
          campaignId,
          provider: result.provider,
          model: result.model,
          promptHash: result.promptHash,
          input: asJson(startedInput),
          output: asJson(result.analysis),
          status: "SUCCESS",
          tokens: result.tokens,
          latencyMs: result.latencyMs,
        },
      }),
    ]);

    return result.analysis;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze JD.";
    await prisma.$transaction([
      prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "FAILED", lastError: message },
      }),
      prisma.generationLog.create({
        data: {
          campaignId,
          provider: process.env.OPENAI_API_KEY ? "openai" : "heuristic",
          model: process.env.OPENAI_MODEL || "unknown",
          input: asJson(startedInput),
          status: "FAILED",
          error: message,
        },
      }),
    ]);
    throw error;
  }
}

export async function generateCampaignOutreach({
  userId,
  campaignId,
}: {
  userId: string;
  campaignId: string;
}) {
  const campaign = await ensureCampaignOwner(userId, campaignId);
  const jobAnalysis =
    (campaign.jobDescription?.analysis as JobAnalysis | undefined) ||
    (await analyzeAndStoreJobDescription({ userId, campaignId }));
  const validContacts = campaign.contacts.filter(
    (contact) => contact.email && contact.isValid
  );
  const invalidContacts = campaign.contacts.filter((contact) => !contact.isValid);
  const results = [];

  for (const contact of invalidContacts) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "NEEDS_REVIEW" },
    });
  }

  for (const contact of validContacts) {
    try {
      const result = await generateOutreachForContact({
        contact: {
          fullName: contact.fullName,
          email: contact.email,
          title: contact.title,
          company: contact.company,
          sourceText: contact.sourceText,
          confidence: contact.confidence,
          isValid: contact.isValid,
          validityReason: contact.validityReason || "Valid email.",
        },
        analysis: jobAnalysis,
      });
      const subject = selectedSubject(result.draft.subjectLineOptions);

      await prisma.$transaction([
        prisma.draft.upsert({
          where: { contactId: contact.id },
          update: {
            resumeId: campaign.resumeId,
            recipient: result.draft.recipient,
            subjectOptions: asJson(result.draft.subjectLineOptions),
            selectedSubject: subject,
            body: result.draft.mainEmail,
            followUp: result.draft.followUpEmail,
            hookSummary: result.draft.hookSummary,
            confidence: result.draft.confidenceScore,
            reasons: asJson(result.draft.reasonsForMatching),
            status: "GENERATED",
            generatedAt: new Date(),
          },
          create: {
            campaignId,
            contactId: contact.id,
            resumeId: campaign.resumeId,
            recipient: result.draft.recipient,
            subjectOptions: asJson(result.draft.subjectLineOptions),
            selectedSubject: subject,
            body: result.draft.mainEmail,
            followUp: result.draft.followUpEmail,
            hookSummary: result.draft.hookSummary,
            confidence: result.draft.confidenceScore,
            reasons: asJson(result.draft.reasonsForMatching),
            status: "GENERATED",
          },
        }),
        prisma.contact.update({
          where: { id: contact.id },
          data: {
            status: "GENERATED",
            generatedContent: asJson(result.draft),
            selectedSubject: subject,
            lastError: null,
          },
        }),
        prisma.generationLog.create({
          data: {
            campaignId,
            contactId: contact.id,
            provider: result.provider,
            model: result.model,
            promptHash: result.promptHash,
            input: asJson({ contact, jobAnalysis }),
            output: asJson(result.draft),
            status: "SUCCESS",
            tokens: result.tokens,
            latencyMs: result.latencyMs,
          },
        }),
      ]);
      results.push(result.draft);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate outreach.";
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contact.id },
          data: { status: "FAILED", lastError: message },
        }),
        prisma.generationLog.create({
          data: {
            campaignId,
            contactId: contact.id,
            provider: process.env.OPENAI_API_KEY ? "openai" : "heuristic",
            model: process.env.OPENAI_MODEL || "unknown",
            input: asJson({ contact, jobAnalysis }),
            status: "FAILED",
            error: message,
          },
        }),
      ]);
    }
  }

  const failureCount = await prisma.contact.count({
    where: { campaignId, status: "FAILED" },
  });
  const successCount = await prisma.contact.count({
    where: { campaignId, status: "GENERATED" },
  });

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status:
        successCount > 0 && failureCount > 0
          ? "PARTIAL"
          : successCount > 0
            ? "GENERATED"
            : "FAILED",
      successCount,
      failureCount,
      generatedContent: asJson({
        count: results.length,
        recipients: results.map((result) => result.recipient),
      }),
      lastError: failureCount > 0 ? "Some contacts failed generation." : null,
    },
  });

  return results;
}

export async function updateContactForUser({
  userId,
  contactId,
  values,
}: {
  userId: string;
  contactId: string;
  values: {
    fullName?: string | null;
    email?: string | null;
    title?: string | null;
    company?: string | null;
  };
}) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      campaign: { userId },
    },
  });

  if (!contact) throw new Error("Contact not found.");

  const email = values.email?.trim().toLowerCase() || null;
  const valid = isValidEmail(email);

  return prisma.contact.update({
    where: { id: contactId },
    data: {
      fullName: values.fullName?.trim() || null,
      email,
      title: values.title?.trim() || null,
      company: values.company?.trim() || null,
      isValid: valid,
      validityReason: valid
        ? "Valid email and enough context to generate outreach."
        : "Missing or invalid email address. This row is skipped until edited.",
      status: valid ? "PARSED" : "NEEDS_REVIEW",
      lastError: null,
    },
  });
}

export async function getCampaignExport(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      resume: true,
      jobDescription: true,
      contacts: {
        include: { draft: true },
        orderBy: { createdAt: "asc" },
      },
      generationLogs: { orderBy: { createdAt: "desc" } },
      deliveryLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!campaign) throw new Error("Campaign not found.");

  return campaign;
}
