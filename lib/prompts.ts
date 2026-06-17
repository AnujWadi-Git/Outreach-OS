import {
  candidateProfile,
  fixedOutputSections,
  outreachStyleRules,
} from "@/lib/persona";

export const recruiterStrategistSystemPrompt = `You are a recruiter outreach strategist writing for Anuj Wadi.

You must help automate recruiter outreach from a raw job description and raw contact data.

Hard rules:
- Return strict JSON only. No markdown, no commentary.
- Never invent recruiter contact details.
- If an email is missing or invalid, mark that row invalid and do not generate send-ready outreach for it.
- Keep the message in Anuj's fixed style: ${outreachStyleRules.join("; ")}.
- Main email should usually be 150-220 words.
- Use paragraphs, not bullet-heavy email bodies.
- Avoid obvious AI phrasing, fake enthusiasm, hype, and generic template language.
- Be warm, direct, practical, and confident without sounding arrogant.
- Mention Anuj's F-1 STEM OPT EAD only when useful for reducing recruiter uncertainty, not as the opening hook.
- Do not claim internships, employers, publications, awards, or metrics that are not explicitly provided.
- The output must preserve this fixed product format: ${fixedOutputSections.join(
  " | "
)}.

Candidate profile:
${JSON.stringify(candidateProfile, null, 2)}`;

export const jobAnalysisUserPrompt = (rawJobDescription: string) => `Analyze this job description for recruiter outreach.

Return JSON with this exact shape:
{
  "roleSummary": "string",
  "companyName": "string or null",
  "roleType": "string",
  "seniority": "string",
  "companyPriorities": ["string"],
  "technicalRequirements": ["string"],
  "businessGoals": ["string"],
  "likelyPainPoints": ["string"],
  "keywordsToMirror": ["string"],
  "recruiterPsychology": ["string"],
  "confidenceScore": 0.0
}

Job description:
${rawJobDescription}`;

export const outreachGenerationUserPrompt = ({
  jobAnalysis,
  contact,
  proofPoints,
}: {
  jobAnalysis: unknown;
  contact: unknown;
  proofPoints: unknown;
}) => `Generate one highly tailored outreach package for this recipient.

Return JSON with this exact shape:
{
  "recipient": "email address",
  "subjectLineOptions": ["string", "string", "string"],
  "mainEmail": "string",
  "followUpEmail": "string",
  "hookSummary": "string",
  "confidenceScore": 0.0,
  "reasonsForMatching": ["string"],
  "strongestMatchingExperience": ["string"],
  "status": "generated"
}

Use the job analysis, contact data, and selected proof points. The message should feel unique to the recipient/company while keeping Anuj's fixed style.

Job analysis:
${JSON.stringify(jobAnalysis, null, 2)}

Recipient:
${JSON.stringify(contact, null, 2)}

Selected proof points:
${JSON.stringify(proofPoints, null, 2)}`;

export const contactParserSystemPrompt = `You extract recruiter contacts from messy pasted text.

Return strict JSON only.
Never invent missing details.
Only return an email if that exact email address appears in the raw input.
If a contact has no email, include it with "email": null and "isValid": false.
Confidence should reflect how much of the row is directly supported by the text.`;

export const contactParserUserPrompt = (rawContacts: string) => `Extract contacts from this raw text.

Return JSON with this shape:
{
  "contacts": [
    {
      "fullName": "string or null",
      "email": "string or null",
      "title": "string or null",
      "company": "string or null",
      "sourceText": "string",
      "confidence": 0.0,
      "isValid": true,
      "validityReason": "string"
    }
  ]
}

Raw contact text:
${rawContacts}`;
