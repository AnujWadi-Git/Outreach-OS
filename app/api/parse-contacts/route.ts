import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { parseContactsWithFallback } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = (await request.json()) as { rawContacts?: string };

    if (!body.rawContacts?.trim()) {
      return NextResponse.json(
        { error: "rawContacts is required." },
        { status: 400 }
      );
    }

    const result = await parseContactsWithFallback(body.rawContacts);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to parse contacts.",
      },
      { status: 500 }
    );
  }
}
