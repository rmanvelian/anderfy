import { NextResponse } from "next/server";
import { fetchJobPostingText } from "@/lib/jobPosting";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url?.trim()) {
      return NextResponse.json({ error: "Missing URL." }, { status: 400 });
    }
    const text = await fetchJobPostingText(url.trim());
    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch that URL.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
