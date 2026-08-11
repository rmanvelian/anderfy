import { NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { tailorResumeToJob } from "@/lib/llm";
import type { TailorOptions } from "@/lib/tailorOptions";
import type { JobPosting, ResumeData } from "@/types/resume";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TailorRequestBody {
  resume: ResumeData;
  jobPosting: JobPosting;
  options?: TailorOptions;
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TailorRequestBody;

    if (!body?.resume) {
      return withCors(
        request,
        NextResponse.json({ error: "Missing resume data." }, { status: 400 })
      );
    }
    if (!body?.jobPosting?.rawText?.trim()) {
      return withCors(
        request,
        NextResponse.json({ error: "Missing job posting text." }, { status: 400 })
      );
    }

    const resume = await tailorResumeToJob(body.resume, body.jobPosting, body.options);
    return withCors(request, NextResponse.json({ resume }));
  } catch (error) {
    console.error("tailor failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to tailor the resume.";
    return withCors(request, NextResponse.json({ error: message }, { status: 500 }));
  }
}
