import { NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { fetchJobPostingText } from "@/lib/jobPosting";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url?.trim()) {
      return withCors(
        request,
        NextResponse.json({ error: "Missing URL." }, { status: 400 })
      );
    }
    const text = await fetchJobPostingText(url.trim());
    return withCors(request, NextResponse.json({ text }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch that URL.";
    return withCors(
      request,
      NextResponse.json({ error: message }, { status: 422 })
    );
  }
}
