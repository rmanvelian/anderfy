import { renderToBuffer } from "@react-pdf/renderer";
import { AndersonResumeDocument } from "@/components/resume/AndersonResumeDocument";
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

    const buffer = await renderToBuffer(<AndersonResumeDocument resume={resume} />);
    const filename = filenameForResume(resume, "pdf");

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("pdf export failed", error);
    const message = error instanceof Error ? error.message : "Failed to generate PDF.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
