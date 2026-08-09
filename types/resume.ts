// Canonical resume data shape shared across parsing, AI tailoring, editing, and export.
// Mirrors the sections/fields used by the official Anderson (Parker CMC) resume template:
// Header, Education, Experience, Additional.

export interface ContactInfo {
  name: string;
  phone?: string;
  email?: string;
  linkedin?: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  location?: string;
  /** e.g. "M.B.A., Full-Time Program, Finance" or "B.A., Economics" */
  degree: string;
  gradDate: string;
  /** Freeform, e.g. "Honors: ...", "Leadership: ...", "Membership: ..." */
  bullets?: string[];
}

export interface ExperienceEntry {
  id: string;
  company: string;
  location?: string;
  title: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface SkillsAndInterests {
  certifications?: string[];
  languages?: string[];
  software?: string[];
  volunteer?: string[];
  interests?: string[];
}

export interface ResumeData {
  contact: ContactInfo;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skillsAndInterests: SkillsAndInterests;
}

export function createEmptyResumeData(): ResumeData {
  return {
    contact: { name: "" },
    education: [],
    experience: [],
    skillsAndInterests: {},
  };
}

export interface JobPosting {
  title?: string;
  company?: string;
  rawText: string;
}
