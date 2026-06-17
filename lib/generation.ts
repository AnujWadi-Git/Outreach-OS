import { z } from "zod";
import { candidateProfile } from "@/lib/persona";
import type { ParsedContact } from "@/lib/parser";
import type { JobAnalysis } from "@/lib/jd-analysis";
import { selectProofPoints } from "@/lib/matching";
import { completeJson, hashPrompt } from "@/lib/openai";
import {
  outreachGenerationUserPrompt,
  recruiterStrategistSystemPrompt,
} from "@/lib/prompts";

export const outreachDraftSchema = z.object({
  recipient: z.string().email(),
  subjectLineOptions: z.array(z.string()).min(3).max(3),
  mainEmail: z.string(),
  followUpEmail: z.string(),
  hookSummary: z.string(),
  confidenceScore: z.number().min(0).max(1),
  reasonsForMatching: z.array(z.string()),
  strongestMatchingExperience: z.array(z.string()),
  status: z.literal("generated"),
});

export type OutreachDraftContent = z.infer<typeof outreachDraftSchema>;

function firstName(fullName: string | null | undefined) {
  return fullName?.split(/\s+/)[0] || "there";
}

function companyLabel(contact: ParsedContact, analysis: JobAnalysis) {
  return (
    contact.company ||
    analysis.companyName ||
    "your team"
  ).replace(/\s+/g, " ");
}

function roleLabel(analysis: JobAnalysis) {
  return analysis.roleType || "AI engineering";
}

function buildFallbackDraft({
  contact,
  analysis,
}: {
  contact: ParsedContact;
  analysis: JobAnalysis;
}): OutreachDraftContent {
  const selectedProofPoints = selectProofPoints(analysis, 3);
  const company = companyLabel(contact, analysis);
  const role = roleLabel(analysis);
  const skills = analysis.keywordsToMirror.slice(0, 4);
  const skillPhrase =
    skills.length > 0
      ? skills.join(", ")
      : candidateProfile.coreTechnicalAreas.slice(0, 4).join(", ");
  const proofPhrase = selectedProofPoints
    .slice(0, 2)
    .map((point) => point.label.toLowerCase())
    .join(" and ");

  return {
    recipient: contact.email || "",
    subjectLineOptions: [
      `${role} interest - Anuj Wadi`,
      `${skillPhrase} background for ${company}`,
      `AI systems builder for ${company}`,
    ].slice(0, 3),
    mainEmail: `Hi ${firstName(contact.fullName)},

I came across the ${role} opportunity${company !== "your team" ? ` with ${company}` : ""} and wanted to reach out directly. The role stood out because it seems focused on practical AI systems, not just model experimentation, and that is where my background is strongest.

I am finishing my MS in Robotics and Autonomous Systems at Arizona State University with an AI focus, and I have been building across ${skillPhrase}. My work is especially aligned with ${proofPhrase || "LLM applications and backend automation"}: connecting AI capability to reliable APIs, workflows, and tools that people can actually use.

I attached my resume for context. If this role is still active, I would be glad to share how my AI systems, automation, and robotics background could be useful for the team.

Best,
Anuj Wadi`,
    followUpEmail: `Hi ${firstName(contact.fullName)},

Just wanted to follow up on my note about the ${role} opportunity${company !== "your team" ? ` at ${company}` : ""}. The combination of ${skillPhrase} and practical product delivery is closely aligned with the AI systems work I have been building.

Happy to send more context or speak if the team is still reviewing candidates.

Best,
Anuj`,
    hookSummary: `Positions Anuj as a practical AI systems builder for ${role}, mirroring ${skillPhrase} and tying his robotics AI background to the team's likely execution needs.`,
    confidenceScore: Math.min(0.85, analysis.confidenceScore),
    reasonsForMatching: selectedProofPoints.map((point) => point.detail),
    strongestMatchingExperience: selectedProofPoints.map((point) => point.label),
    status: "generated",
  };
}

function ensureValidDraft(
  draft: OutreachDraftContent,
  contact: ParsedContact
): OutreachDraftContent {
  return {
    ...draft,
    recipient: contact.email || draft.recipient,
    subjectLineOptions: draft.subjectLineOptions.slice(0, 3),
    status: "generated",
  };
}

export async function generateOutreachForContact({
  contact,
  analysis,
}: {
  contact: ParsedContact;
  analysis: JobAnalysis;
}) {
  if (!contact.email) {
    throw new Error("Cannot generate outreach for a contact without an email.");
  }

  const proofPoints = selectProofPoints(analysis, 4);
  const promptPayload = {
    system: recruiterStrategistSystemPrompt,
    user: outreachGenerationUserPrompt({
      jobAnalysis: analysis,
      contact,
      proofPoints,
    }),
  };

  if (!process.env.OPENAI_API_KEY) {
    return {
      draft: buildFallbackDraft({ contact, analysis }),
      provider: "heuristic",
      model: "local-heuristic",
      latencyMs: 0,
      tokens: undefined,
      promptHash: hashPrompt(promptPayload),
    };
  }

  const completion = await completeJson<unknown>({
    system: recruiterStrategistSystemPrompt,
    user: promptPayload.user,
    temperature: 0.45,
  });

  const parsed = outreachDraftSchema.parse(completion.data);

  return {
    draft: ensureValidDraft(parsed, contact),
    provider: "openai",
    model: completion.model,
    latencyMs: completion.latencyMs,
    tokens: completion.tokens,
    promptHash: hashPrompt(promptPayload),
  };
}
