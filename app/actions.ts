"use server";

import type { CampaignMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  createCampaignFromInput,
  generateCampaignOutreach,
  updateContactForUser,
} from "@/lib/campaign-workflow";
import {
  createGmailDraftsForCampaign,
  resyncGmailStatusForCampaign,
  sendEmailsForCampaign,
} from "@/lib/gmail";
import { prisma } from "@/lib/prisma";
import {
  saveResumeForUser,
  setDefaultResume,
} from "@/lib/resume-storage";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialError = (message: string): ActionState => ({
  status: "error",
  message,
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseMode(value: string): CampaignMode {
  if (value === "SEND") return "SEND";
  if (value === "DRY_RUN") return "DRY_RUN";
  return "DRAFT";
}

export async function createCampaignAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const resumeFile = formData.get("resumeFile");
    let resumeId = formOptionalString(formData, "resumeId");

    if (resumeFile instanceof File && resumeFile.size > 0) {
      const resume = await saveResumeForUser({
        userId: user.id,
        file: resumeFile,
        makeDefault: formData.get("makeDefaultResume") === "on",
      });
      resumeId = resume.id;
    }

    const campaign = await createCampaignFromInput({
      userId: user.id,
      name: formString(formData, "name"),
      rawJobDescription: formString(formData, "rawJobDescription"),
      rawContacts: formString(formData, "rawContacts"),
      mode: parseMode(formString(formData, "mode")),
      resumeId,
    });

    revalidatePath("/");
    redirect(`/campaigns/${campaign.id}`);
  } catch (error) {
    if ((error as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    return initialError(
      error instanceof Error ? error.message : "Failed to create campaign."
    );
  }
}

export async function uploadResumeAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const resumeFile = formData.get("resumeFile");

    if (!(resumeFile instanceof File)) {
      throw new Error("Please choose a PDF resume.");
    }

    await saveResumeForUser({
      userId: user.id,
      file: resumeFile,
      makeDefault: true,
    });

    revalidatePath("/");
    revalidatePath("/campaigns/new");

    return { status: "success", message: "Default resume saved." };
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Failed to upload resume."
    );
  }
}

export async function setDefaultResumeAction(formData: FormData) {
  const user = await requireUser();
  const resumeId = formString(formData, "resumeId");
  await setDefaultResume(user.id, resumeId);
  revalidatePath("/");
  revalidatePath("/campaigns/new");
}

export async function regenerateCampaignAction(formData: FormData) {
  const user = await requireUser();
  const campaignId = formString(formData, "campaignId");
  await generateCampaignOutreach({ userId: user.id, campaignId });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}

export async function createDraftsAction(formData: FormData) {
  const user = await requireUser();
  const campaignId = formString(formData, "campaignId");
  await createGmailDraftsForCampaign(user.id, campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}

export async function sendCampaignAction(formData: FormData) {
  const user = await requireUser();
  const campaignId = formString(formData, "campaignId");
  const confirmed = formString(formData, "confirmSend") === "SEND_NOW";

  await sendEmailsForCampaign({
    userId: user.id,
    campaignId,
    confirmed,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}

export async function resyncCampaignAction(formData: FormData) {
  const user = await requireUser();
  const campaignId = formString(formData, "campaignId");
  await resyncGmailStatusForCampaign(user.id, campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function updateContactAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const contactId = formString(formData, "contactId");

    await updateContactForUser({
      userId: user.id,
      contactId,
      values: {
        fullName: formOptionalString(formData, "fullName"),
        email: formOptionalString(formData, "email"),
        title: formOptionalString(formData, "title"),
        company: formOptionalString(formData, "company"),
      },
    });

    const campaignId = formString(formData, "campaignId");
    revalidatePath(`/campaigns/${campaignId}`);
    return { status: "success", message: "Contact updated." };
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Failed to update contact."
    );
  }
}

export async function updateDraftAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const draftId = formString(formData, "draftId");
    const draft = await prisma.draft.findFirst({
      where: {
        id: draftId,
        campaign: { userId: user.id },
      },
      select: {
        id: true,
        campaignId: true,
        contactId: true,
      },
    });

    if (!draft) throw new Error("Draft not found.");

    const selectedSubject = formString(formData, "selectedSubject").trim();
    const body = formString(formData, "body").trim();
    const followUp = formString(formData, "followUp").trim();
    const hookSummary = formString(formData, "hookSummary").trim();

    if (!selectedSubject || !body || !followUp) {
      throw new Error("Subject, main email, and follow-up are required.");
    }

    await prisma.$transaction([
      prisma.draft.update({
        where: { id: draft.id },
        data: {
          selectedSubject,
          body,
          followUp,
          hookSummary,
          gmailDraftId: null,
          gmailMessageId: null,
          status: "GENERATED",
        },
      }),
      prisma.contact.update({
        where: { id: draft.contactId },
        data: {
          selectedSubject,
          gmailDraftId: null,
          gmailMessageId: null,
          status: "GENERATED",
        },
      }),
    ]);

    revalidatePath(`/campaigns/${draft.campaignId}`);
    return {
      status: "success",
      message: "Draft updated. Gmail IDs were cleared so it can be recreated.",
    };
  } catch (error) {
    return initialError(
      error instanceof Error ? error.message : "Failed to update draft."
    );
  }
}
