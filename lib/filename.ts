import type { ResumeData } from "@/types/resume";

export function filenameForResume(resume: ResumeData, extension: "pdf" | "docx"): string {
  const base = (resume.contact.name || "resume")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_");
  return `${base || "resume"}_Anderson_Resume.${extension}`;
}
