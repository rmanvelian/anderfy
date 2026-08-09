// Canonical resume data shape shared across parsing, AI tailoring, editing, and export.

export interface ContactInfo {
  name: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  location?: string;
}

export interface EducationEntry {
  id: string;
  school: string;
  location?: string;
  degree: string;
  field?: string;
  gpa?: string;
  honors?: string;
  gradDate: string;
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

export interface LeadershipEntry {
  id: string;
  org: string;
  role: string;
  location?: string;
  dates?: string;
  bullets?: string[];
}

export interface SkillsAndInterests {
  skills?: string[];
  languages?: string[];
  interests?: string[];
}

export interface ResumeData {
  contact: ContactInfo;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  leadership: LeadershipEntry[];
  skillsAndInterests: SkillsAndInterests;
}

export function createEmptyResumeData(): ResumeData {
  return {
    contact: { name: "" },
    education: [],
    experience: [],
    leadership: [],
    skillsAndInterests: {},
  };
}

export interface JobPosting {
  title?: string;
  company?: string;
  rawText: string;
}

export interface TailorResult {
  resume: ResumeData;
  notes?: string[];
}
