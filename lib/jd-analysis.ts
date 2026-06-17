import { z } from "zod";
import { completeJson, hashPrompt } from "@/lib/openai";
import {
  jobAnalysisUserPrompt,
  recruiterStrategistSystemPrompt,
} from "@/lib/prompts";

export const jobAnalysisSchema = z.object({
  roleSummary: z.string(),
  companyName: z.string().nullable(),
  roleType: z.string(),
  seniority: z.string(),
  companyPriorities: z.array(z.string()),
  technicalRequirements: z.array(z.string()),
  businessGoals: z.array(z.string()),
  likelyPainPoints: z.array(z.string()),
  keywordsToMirror: z.array(z.string()),
  recruiterPsychology: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

const knownSkills = [
  "LLM",
  "RAG",
  "AI agents",
  "multimodal AI",
  "FastAPI",
  "backend",
  "APIs",
  "cloud",
  "workflow automation",
  "machine learning",
  "computer vision",
  "robotics",
  "Python",
  "TypeScript",
  "React",
  "Next.js",
  "Postgres",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
];

function inferCompany(raw: string) {
  const patterns = [
    /company\s*[:\-]\s*([^\n]{2,80})/i,
    /at\s+([A-Z][A-Za-z0-9&.,' -]{2,60})\s+(?:is|we are|seeks|looking)/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[.。]$/, "");
  }

  return null;
}

function inferRoleType(raw: string) {
  const firstUsefulLine = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 5 && line.length < 120);

  const roleMatch = raw.match(
    /(senior|staff|principal|lead|entry[- ]level|junior)?\s*(ai|machine learning|software|full[- ]stack|backend|robotics|automation)\s+engineer/iu
  );

  return roleMatch?.[0]?.replace(/\s+/g, " ").trim() || firstUsefulLine || "AI Engineer";
}

function inferSeniority(raw: string) {
  if (/principal/i.test(raw)) return "Principal";
  if (/staff/i.test(raw)) return "Staff";
  if (/senior|sr\./i.test(raw)) return "Senior";
  if (/lead/i.test(raw)) return "Lead";
  if (/junior|entry[- ]level|new grad/i.test(raw)) return "Early career";
  return "Mid-level or unspecified";
}

function findSkills(raw: string) {
  const lower = raw.toLowerCase();
  return knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
}

export function heuristicJobAnalysis(raw: string): JobAnalysis {
  const skills = findSkills(raw);
  const roleType = inferRoleType(raw);
  const companyName = inferCompany(raw);

  return {
    roleSummary: `${roleType} role focused on ${
      skills.slice(0, 4).join(", ") || "applied AI and software systems"
    }.`,
    companyName,
    roleType,
    seniority: inferSeniority(raw),
    companyPriorities: [
      "Ship reliable systems, not just prototypes",
      "Connect technical AI capability to practical business workflows",
      "Find candidates who can collaborate across product and engineering",
    ],
    technicalRequirements:
      skills.length > 0
        ? skills
        : ["AI systems", "backend engineering", "cloud deployment"],
    businessGoals: [
      "Improve operational speed",
      "Create dependable automation",
      "Reduce manual work through usable software",
    ],
    likelyPainPoints: [
      "Moving AI features from proof of concept into production",
      "Integrating models with existing systems and data",
      "Finding engineers who can balance research curiosity with product delivery",
    ],
    keywordsToMirror:
      skills.length > 0
        ? skills
        : ["AI systems", "automation", "backend", "deployment"],
    recruiterPsychology: [
      "Show quick relevance to the role",
      "Reduce uncertainty around work authorization and availability",
      "Make the resume attachment feel worth opening",
    ],
    confidenceScore: skills.length > 0 ? 0.72 : 0.55,
  };
}

export async function analyzeJobDescription(raw: string) {
  const promptPayload = {
    system: recruiterStrategistSystemPrompt,
    user: jobAnalysisUserPrompt(raw),
  };

  if (!process.env.OPENAI_API_KEY) {
    return {
      analysis: heuristicJobAnalysis(raw),
      provider: "heuristic",
      model: "local-heuristic",
      latencyMs: 0,
      tokens: undefined,
      promptHash: hashPrompt(promptPayload),
    };
  }

  const completion = await completeJson<unknown>({
    system: recruiterStrategistSystemPrompt,
    user: jobAnalysisUserPrompt(raw),
    temperature: 0.2,
  });

  const parsed = jobAnalysisSchema.parse(completion.data);

  return {
    analysis: parsed,
    provider: "openai",
    model: completion.model,
    latencyMs: completion.latencyMs,
    tokens: completion.tokens,
    promptHash: hashPrompt(promptPayload),
  };
}
