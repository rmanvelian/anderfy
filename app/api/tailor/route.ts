import { NextResponse } from "next/server";
import { tailorResumeToJob } from "@/lib/llm";
import type { JobPosting, ResumeData } from "@/types/resume";

export const runtime = "nodejs";

interface TailorRequestBody {
  resume: ResumeData;
  jobPosting: JobPosting;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TailorRequestBody;

    if (!body?.resume) {
      return NextResponse.json({ error: "Missing resume data." }, { status: 400 });
    }
    if (!body?.jobPosting?.rawText?.trim()) {
      return NextResponse.json(
        { error: "Missing job posting text." },
        { status: 400 }
      );
    }

    const resume = await tailorResumeToJob(body.resume, body.jobPosting);
    return NextResponse.json({ resume });
  } catch (error) {
    console.error("tailor failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to tailor the resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
