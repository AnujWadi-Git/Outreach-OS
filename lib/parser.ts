import { z } from "zod";
import { completeJson } from "@/lib/openai";
import {
  contactParserSystemPrompt,
  contactParserUserPrompt,
} from "@/lib/prompts";
import { compactWhitespace } from "@/lib/utils";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const emailSchema = z.string().email();

const titleWords = [
  "recruiter",
  "talent",
  "sourcer",
  "people",
  "hr",
  "human resources",
  "hiring",
  "manager",
  "director",
  "lead",
  "partner",
  "coordinator",
  "specialist",
  "acquisition",
];

const companyNoise = [
  "linkedin",
  "apollo",
  "email",
  "phone",
  "mobile",
  "profile",
  "connect",
  "message",
  "view",
];

export type ParsedContact = {
  fullName: string | null;
  email: string | null;
  title: string | null;
  company: string | null;
  sourceText: string;
  confidence: number;
  isValid: boolean;
  validityReason: string;
};

export type ParseContactsResult = {
  contacts: ParsedContact[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  usedLLMFallback: boolean;
};

type LLMContactsResponse = {
  contacts?: ParsedContact[];
};

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

export function isValidEmail(email: string | null | undefined) {
  if (!email) return false;
  return emailSchema.safeParse(email).success;
}

function normalizeRawContacts(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[<>]/g, (match) => ` ${match} `);
}

function getLineWindow(lines: string[], index: number) {
  const start = Math.max(0, index - 2);
  const end = Math.min(lines.length, index + 3);

  return lines
    .slice(start, end)
    .map((line) => line.trim())
    .filter(Boolean);
}

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part
        )
        .join("-")
    )
    .join(" ");
}

function looksLikeName(value: string) {
  const cleaned = value
    .replace(/[^\p{L}\p{M}.'\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length > 70) return false;
  if (/\d|@|https?:\/\//i.test(cleaned)) return false;

  const lower = cleaned.toLowerCase();
  if (titleWords.some((word) => lower.includes(word))) return false;
  if (companyNoise.some((word) => lower === word || lower.includes(`${word} `))) {
    return false;
  }

  const parts = cleaned.split(/\s+/);
  return parts.length >= 2 && parts.length <= 5;
}

function cleanNameCandidate(value: string) {
  const candidate = value
    .replace(emailPattern, " ")
    .replace(/[<>()"'`]/g, " ")
    .split(/\s[-|,;]\s|[,;|]/)
    .map((part) => compactWhitespace(part))
    .filter(Boolean)
    .pop();

  if (!candidate) return null;

  const cleaned = candidate
    .replace(/^(name|contact|recipient)\s*[:=-]\s*/i, "")
    .replace(/[^\p{L}\p{M}.'\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return looksLikeName(cleaned) ? titleCaseName(cleaned) : null;
}

function extractName(line: string, email: string, surroundingLines: string[]) {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const angleMatch = line.match(
    new RegExp(`([^\\n<>]{2,90})\\s*<\\s*${escaped}\\s*>`, "i")
  );

  if (angleMatch) {
    const fromAngle = cleanNameCandidate(angleMatch[1]);
    if (fromAngle) return fromAngle;
  }

  const emailIndex = line.toLowerCase().indexOf(email.toLowerCase());
  if (emailIndex > -1) {
    const prefix = line.slice(Math.max(0, emailIndex - 100), emailIndex);
    const fromPrefix = cleanNameCandidate(prefix);
    if (fromPrefix) return fromPrefix;
  }

  for (const candidateLine of surroundingLines) {
    if (candidateLine.includes("@")) continue;
    const maybeName = cleanNameCandidate(candidateLine);
    if (maybeName) return maybeName;
  }

  return null;
}

function extractTitleAndCompany(
  lines: string[],
  name: string | null,
  email: string
) {
  let title: string | null = null;
  let company: string | null = null;

  for (const rawLine of lines) {
    const line = compactWhitespace(rawLine.replace(emailPattern, " "));
    if (!line || line.toLowerCase() === name?.toLowerCase()) continue;
    if (line.toLowerCase().includes(email.toLowerCase())) continue;

    const lower = line.toLowerCase();
    const isTitle = titleWords.some((word) => lower.includes(word));

    if (!title && isTitle) {
      title = line.slice(0, 120);
      continue;
    }

    const isNoise = companyNoise.some((word) => lower.includes(word));
    if (!company && !isNoise && !looksLikeName(line) && line.length <= 120) {
      company = line
        .replace(/^(company|organization)\s*[:=-]\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return { title, company };
}

function confidenceFor(contact: ParsedContact) {
  let confidence = 0;
  if (contact.email && contact.isValid) confidence += 0.45;
  if (contact.fullName) confidence += 0.25;
  if (contact.title) confidence += 0.15;
  if (contact.company) confidence += 0.1;
  if (contact.sourceText.length > 0) confidence += 0.05;
  return Number(Math.min(confidence, 0.98).toFixed(2));
}

function invalidReason(email: string | null, fullName: string | null) {
  if (!email) return "Missing email address. This row is skipped until edited.";
  if (!isValidEmail(email)) return "Invalid email syntax.";
  if (!fullName) return "Email is valid, but the contact name needs review.";
  return "Valid email and enough context to generate outreach.";
}

function dedupeContacts(contacts: ParsedContact[]) {
  const seen = new Set<string>();
  const deduped: ParsedContact[] = [];
  let duplicateCount = 0;

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);

    if (email) {
      if (seen.has(email)) {
        duplicateCount += 1;
        continue;
      }

      seen.add(email);
    }

    deduped.push({
      ...contact,
      email,
      isValid: isValidEmail(email),
      validityReason: invalidReason(email, contact.fullName),
    });
  }

  return { deduped, duplicateCount };
}

function parseNoEmailBlocks(raw: string, existingSources: Set<string>) {
  return raw
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 5 && !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(block))
    .filter((block) => !existingSources.has(block))
    .map((block): ParsedContact | null => {
      const lines = block
        .split("\n")
        .map((line) => compactWhitespace(line))
        .filter(Boolean);
      const nameLine = lines.find((line) => looksLikeName(line));

      if (!nameLine) return null;

      const titleLine = lines.find((line) =>
        titleWords.some((word) => line.toLowerCase().includes(word))
      );
      const companyLine = lines.find(
        (line) => line !== nameLine && line !== titleLine && line.length <= 120
      );

      return {
        fullName: titleCaseName(nameLine),
        email: null,
        title: titleLine || null,
        company: companyLine || null,
        sourceText: block,
        confidence: 0.35,
        isValid: false,
        validityReason: "Missing email address. This row is skipped until edited.",
      } satisfies ParsedContact;
    })
    .filter((contact): contact is ParsedContact => Boolean(contact));
}

export function parseContacts(raw: string): ParseContactsResult {
  const normalized = normalizeRawContacts(raw);
  const lines = normalized.split("\n");
  const contacts: ParsedContact[] = [];
  const sourceSet = new Set<string>();

  lines.forEach((line, index) => {
    const matches = [...line.matchAll(emailPattern)];
    emailPattern.lastIndex = 0;

    for (const match of matches) {
      const email = normalizeEmail(match[0]);
      const windowLines = getLineWindow(lines, index);
      const sourceText = windowLines.join("\n");
      sourceSet.add(sourceText);

      const fullName = email ? extractName(line, email, windowLines) : null;
      const { title, company } = email
        ? extractTitleAndCompany(windowLines, fullName, email)
        : { title: null, company: null };
      const isValid = isValidEmail(email);
      const contact: ParsedContact = {
        fullName,
        email,
        title,
        company,
        sourceText,
        confidence: 0,
        isValid,
        validityReason: invalidReason(email, fullName),
      };

      contact.confidence = confidenceFor(contact);
      contacts.push(contact);
    }
  });

  contacts.push(...parseNoEmailBlocks(normalized, sourceSet));

  const { deduped, duplicateCount } = dedupeContacts(contacts);
  const validCount = deduped.filter((contact) => contact.isValid).length;

  return {
    contacts: deduped,
    validCount,
    invalidCount: deduped.length - validCount,
    duplicateCount,
    usedLLMFallback: false,
  };
}

function needsLLMFallback(result: ParseContactsResult) {
  if (result.contacts.length === 0) return true;
  const missingNames = result.contacts.filter(
    (contact) => contact.email && !contact.fullName
  ).length;
  return missingNames > 0 || result.invalidCount > 0;
}

function sanitizeLLMContacts(raw: string, contacts: ParsedContact[]) {
  const rawLower = raw.toLowerCase();

  return contacts.map((contact) => {
    const email = normalizeEmail(contact.email);
    const emailActuallyAppears = email ? rawLower.includes(email) : false;
    const safeEmail = emailActuallyAppears ? email : null;
    const isValid = isValidEmail(safeEmail);
    const sanitized: ParsedContact = {
      fullName: contact.fullName ? compactWhitespace(contact.fullName) : null,
      email: safeEmail,
      title: contact.title ? compactWhitespace(contact.title) : null,
      company: contact.company ? compactWhitespace(contact.company) : null,
      sourceText: contact.sourceText || raw.slice(0, 500),
      confidence:
        typeof contact.confidence === "number"
          ? Math.max(0, Math.min(contact.confidence, 1))
          : 0.5,
      isValid,
      validityReason: emailActuallyAppears
        ? invalidReason(safeEmail, contact.fullName)
        : "LLM output omitted because the email was not present in the pasted text.",
    };

    sanitized.confidence = confidenceFor(sanitized);
    return sanitized;
  });
}

export async function parseContactsWithFallback(
  raw: string
): Promise<ParseContactsResult> {
  const regexResult = parseContacts(raw);

  if (!needsLLMFallback(regexResult) || !process.env.OPENAI_API_KEY) {
    return regexResult;
  }

  try {
    const completion = await completeJson<LLMContactsResponse>({
      system: contactParserSystemPrompt,
      user: contactParserUserPrompt(raw),
      temperature: 0,
    });
    const llmContacts = sanitizeLLMContacts(
      raw,
      Array.isArray(completion.data.contacts) ? completion.data.contacts : []
    );

    if (llmContacts.length === 0) return regexResult;

    const mergedByEmail = new Map<string, ParsedContact>();
    const noEmailContacts: ParsedContact[] = [];

    for (const contact of regexResult.contacts) {
      if (contact.email) {
        mergedByEmail.set(contact.email, contact);
      } else {
        noEmailContacts.push(contact);
      }
    }

    for (const contact of llmContacts) {
      if (contact.email) {
        const existing = mergedByEmail.get(contact.email);
        mergedByEmail.set(contact.email, {
          ...(existing || contact),
          ...contact,
          sourceText: existing?.sourceText || contact.sourceText,
          confidence: Math.max(existing?.confidence || 0, contact.confidence),
        });
      } else {
        noEmailContacts.push(contact);
      }
    }

    const contacts = [...mergedByEmail.values(), ...noEmailContacts];
    const { deduped, duplicateCount } = dedupeContacts(contacts);
    const validCount = deduped.filter((contact) => contact.isValid).length;

    return {
      contacts: deduped,
      validCount,
      invalidCount: deduped.length - validCount,
      duplicateCount: regexResult.duplicateCount + duplicateCount,
      usedLLMFallback: true,
    };
  } catch (error) {
    console.error("Contact LLM fallback failed", error);
    return regexResult;
  }
}
