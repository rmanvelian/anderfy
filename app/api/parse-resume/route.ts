import { NextResponse } from "next/server";
import { extractTextFromFile, UnsupportedFileTypeError } from "@/lib/parseFile";
import { extractResumeFromText } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pastedText = formData.get("text");

    let rawText = "";

    if (file instanceof File) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "That file is too large (max 10MB)." },
          { status: 400 }
        );
      }
      const buffer = await file.arrayBuffer();
      rawText = await extractTextFromFile(buffer, file.name, file.type);
    } else if (typeof pastedText === "string" && pastedText.trim()) {
      rawText = pastedText;
    } else {
      return NextResponse.json(
        { error: "Provide a resume file or pasted resume text." },
        { status: 400 }
      );
    }

    if (!rawText || rawText.trim().length < 30) {
      return NextResponse.json(
        {
          error:
            "Couldn't find enough readable text in that resume. Try a different file, or paste the resume text directly.",
        },
        { status: 422 }
      );
    }

    const resume = await extractResumeFromText(rawText);
    return NextResponse.json({ resume, rawText });
  } catch (error) {
    if (error instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("parse-resume failed", error);
    const message =
      error instanceof Error ? error.message : "Failed to parse the resume.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
