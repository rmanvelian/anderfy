import { withBasePath } from "@/lib/apiBase";
import { finalizeResumeAgainstSource } from "@/lib/finalizeResume";
import { extractResumeHeuristically, tailorResumeHeuristically } from "@/lib/heuristicResume";
import { fitResumeToOnePage } from "@/lib/pageFit";
import { extractTextFromFile, UnsupportedFileTypeError } from "@/lib/parseFile";
import type { TailorOptions } from "@/lib/tailorOptions";
import type { JobPosting, ResumeData } from "@/types/resume";

/** GitHub Pages / `output: "export"` builds have no Node `/api/*` routes. */
function isStaticExportClient(): boolean {
  return process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
}

function isResumeData(value: unknown): value is ResumeData {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ResumeData>;
  return (
    !!v.contact &&
    typeof v.contact === "object" &&
    Array.isArray(v.education) &&
    Array.isArray(v.experience) &&
    !!v.skillsAndInterests &&
    typeof v.skillsAndInterests === "object"
  );
}

async function readApiJson(res: Response): Promise<unknown | null> {
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  // Static hosts often return HTML (200/404) for missing API routes — never treat as JSON.
  if (!contentType.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Parse a resume via the Node API when available (local `next dev` / a real
 * host with keys). On GitHub Pages / static export there is no API, so fall
 * back to the free heuristic parser that runs entirely in the browser.
 */
export async function parseResumeClient(input: {
  file?: File;
  text?: string;
}): Promise<ResumeData> {
  if (!isStaticExportClient()) {
    try {
      const formData = new FormData();
      if (input.file) formData.append("file", input.file);
      if (input.text) formData.append("text", input.text);

      const res = await fetch(withBasePath("/api/parse-resume"), {
        method: "POST",
        body: formData,
      });
      const data = await readApiJson(res);
      if (data && typeof data === "object" && isResumeData((data as { resume?: unknown }).resume)) {
        return (data as { resume: ResumeData }).resume;
      }
      // 404/405 / non-JSON = static host or misconfigured proxy — use local parser.
      if (res.ok || res.status === 404 || res.status === 405) {
        // fall through
      } else {
        const err = data as { error?: string } | null;
        throw new Error(err?.error || "Failed to parse resume.");
      }
    } catch (error) {
      if (error instanceof Error && !isNetworkOrMissingApi(error)) throw error;
    }
  }

  return parseResumeLocally(input);
}

async function parseResumeLocally(input: {
  file?: File;
  text?: string;
}): Promise<ResumeData> {
  let rawText = "";
  if (input.file) {
    if (input.file.size > 10 * 1024 * 1024) {
      throw new Error("That file is too large (max 10MB).");
    }
    try {
      rawText = await extractTextFromFile(
        await input.file.arrayBuffer(),
        input.file.name,
        input.file.type
      );
    } catch (error) {
      if (error instanceof UnsupportedFileTypeError) throw error;
      throw new Error(
        error instanceof Error ? error.message : "Failed to read that file."
      );
    }
  } else if (input.text?.trim()) {
    rawText = input.text;
  } else {
    throw new Error("Provide a resume file or pasted resume text.");
  }

  if (!rawText || rawText.trim().length < 30) {
    throw new Error(
      "Couldn't find enough readable text in that resume. Try a different file, or paste the resume text directly."
    );
  }

  return fitResumeToOnePage(extractResumeHeuristically(rawText));
}

export async function tailorResumeClient(
  resume: ResumeData,
  jobPosting: JobPosting,
  options: TailorOptions = {}
): Promise<ResumeData> {
  if (!isStaticExportClient()) {
    try {
      const res = await fetch(withBasePath("/api/tailor"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resume, jobPosting, options }),
      });
      const data = await readApiJson(res);
      if (data && typeof data === "object" && isResumeData((data as { resume?: unknown }).resume)) {
        return (data as { resume: ResumeData }).resume;
      }
      if (!(res.ok || res.status === 404 || res.status === 405)) {
        const err = data as { error?: string } | null;
        throw new Error(err?.error || "Failed to tailor your resume.");
      }
    } catch (error) {
      if (error instanceof Error && !isNetworkOrMissingApi(error)) throw error;
    }
  }

  return finalizeResumeAgainstSource(
    tailorResumeHeuristically(resume, jobPosting, options),
    resume
  );
}

export async function fetchJobPostingText(url: string): Promise<string> {
  if (isStaticExportClient()) {
    throw new Error(
      "URL fetch isn't available on this static host (GitHub Pages). Paste the job description text instead."
    );
  }

  try {
    const res = await fetch(withBasePath("/api/job-posting/fetch"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await readApiJson(res);
    if (data && typeof data === "object" && typeof (data as { text?: unknown }).text === "string") {
      return (data as { text: string }).text;
    }
    if (!(res.ok || res.status === 404 || res.status === 405)) {
      const err = data as { error?: string } | null;
      throw new Error(err?.error || "Couldn't fetch that URL.");
    }
  } catch (error) {
    if (error instanceof Error && !isNetworkOrMissingApi(error)) throw error;
  }

  throw new Error(
    "URL fetch isn't available on this static host (GitHub Pages). Paste the job description text instead."
  );
}

function isNetworkOrMissingApi(error: Error): boolean {
  // fetch() rejects on network failure; static hosts have no /api/* routes.
  // Also treat failed JSON bodies from HTML fallback pages as missing API.
  return (
    error.name === "TypeError" ||
    error.name === "SyntaxError" ||
    /Failed to fetch|NetworkError|Load failed|fetch|Unexpected token|JSON/i.test(error.message)
  );
}
