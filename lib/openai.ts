import crypto from "node:crypto";
import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  cachedClient ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return cachedClient;
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export function hashPrompt(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export function parseJsonObject<T>(content: string): T {
  const trimmed = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(trimmed) as T;
}

export async function completeJson<T>({
  system,
  user,
  temperature = 0.3,
}: {
  system: string;
  user: string;
  temperature?: number;
}) {
  const client = getOpenAIClient();

  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = getOpenAIModel();
  const startedAt = Date.now();
  const completion = await client.chat.completions.create({
    model,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return {
    data: parseJsonObject<T>(content),
    model,
    latencyMs: Date.now() - startedAt,
    tokens: completion.usage?.total_tokens,
  };
}
