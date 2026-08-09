import { buildResumeDocx } from "@/lib/docx-export";
import { filenameForResume } from "@/lib/filename";
import type { ResumeData } from "@/types/resume";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { resume } = (await request.json()) as { resume: ResumeData };
    if (!resume) {
      return new Response(JSON.stringify({ error: "Missing resume data." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const buffer = await buildResumeDocx(resume);
    const filename = filenameForResume(resume, "docx");

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("docx export failed", error);
    const message = error instanceof Error ? error.message : "Failed to generate DOCX.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
