import { withBasePath } from "@/lib/apiBase";
import { normalizeExperienceBullets } from "@/lib/experienceBullets";
import { extractResumeHeuristically, tailorResumeHeuristically } from "@/lib/heuristicResume";
import { fitResumeToOnePage } from "@/lib/pageFit";
import { extractTextFromFile, UnsupportedFileTypeError } from "@/lib/parseFile";
import type { TailorOptions } from "@/lib/tailorOptions";
import type { JobPosting, ResumeData } from "@/types/resume";

/**
 * Parse a resume via the Node API when available (local `next dev` / a real
 * host with keys). On GitHub Pages / static export there is no API, so fall
 * back to the free heuristic parser that runs entirely in the browser.
 */
export async function parseResumeClient(input: {
  file?: File;
  text?: string;
}): Promise<ResumeData> {
  try {
    const formData = new FormData();
    if (input.file) formData.append("file", input.file);
    if (input.text) formData.append("text", input.text);

    const res = await fetch(withBasePath("/api/parse-resume"), {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = (await res.json()) as { resume: ResumeData };
      return data.resume;
    }
    // 404/405 = static host with no API; other errors should surface.
    if (res.status !== 404 && res.status !== 405) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Failed to parse resume.");
    }
  } catch (error) {
    if (error instanceof Error && !isNetworkOrMissingApi(error)) throw error;
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
  try {
    const res = await fetch(withBasePath("/api/tailor"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume, jobPosting, options }),
    });
    if (res.ok) {
      const data = (await res.json()) as { resume: ResumeData };
      return data.resume;
    }
    if (res.status !== 404 && res.status !== 405) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Failed to tailor your resume.");
    }
  } catch (error) {
    if (error instanceof Error && !isNetworkOrMissingApi(error)) throw error;
  }

  const fitted = fitResumeToOnePage(
    normalizeExperienceBullets(tailorResumeHeuristically(resume, jobPosting, options), resume)
  );
  return normalizeExperienceBullets(fitted, resume);
}

export async function fetchJobPostingText(url: string): Promise<string> {
  try {
    const res = await fetch(withBasePath("/api/job-posting/fetch"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = (await res.json()) as { text: string };
      return data.text;
    }
    if (res.status !== 404 && res.status !== 405) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Couldn't fetch that URL.");
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
  return (
    error.name === "TypeError" ||
    /Failed to fetch|NetworkError|Load failed|fetch/i.test(error.message)
  );
}
