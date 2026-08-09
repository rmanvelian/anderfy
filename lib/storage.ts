import type { JobPosting, ResumeData } from "@/types/resume";

const STORAGE_KEY = "anderfy:draft:v1";

export interface StoredDraft {
  resume: ResumeData;
  jobPosting: JobPosting;
  notes?: string[];
  step: "source" | "job" | "review";
}

export function loadDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: StoredDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage errors (e.g. private browsing quota).
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
