import { newId } from "@/lib/id";
import type { ResumeData } from "@/types/resume";

// Deterministic sample data used when MOCK_LLM=1 (or no API key is configured),
// so the upload -> tailor -> edit -> export pipeline can be exercised end-to-end
// without a live OpenAI key.
export function mockResumeData(): ResumeData {
  return {
    contact: {
      name: "Jordan Rivera",
      phone: "(555) 123-4567",
      email: "jordan.rivera@email.com",
      linkedin: "linkedin.com/in/jordanrivera",
      location: "Los Angeles, CA",
    },
    education: [
      {
        id: newId(),
        school: "University of California, Santa Barbara",
        location: "Santa Barbara, CA",
        degree: "B.A.",
        field: "Economics",
        gpa: "3.7",
        honors: "Cum Laude",
        gradDate: "Jun 2018",
        bullets: [
          "Treasurer, Student Investment Fund; managed a $50,000 portfolio and presented quarterly performance to a faculty board",
        ],
      },
    ],
    experience: [
      {
        id: newId(),
        company: "Meridian Consulting Group",
        location: "Los Angeles, CA",
        title: "Senior Business Analyst",
        startDate: "Jul 2021",
        endDate: "Present",
        bullets: [
          "Led a 4-person team on a supply-chain optimization project for a $2B retail client, identifying $3.4M in annual savings",
          "Built a pricing model adopted by 3 business units, improving gross margin by 6% within two quarters",
          "Managed relationships with 8 client stakeholders, translating ambiguous business goals into a 12-week delivery roadmap",
        ],
      },
      {
        id: newId(),
        company: "Meridian Consulting Group",
        location: "Los Angeles, CA",
        title: "Business Analyst",
        startDate: "Jul 2018",
        endDate: "Jun 2021",
        bullets: [
          "Analyzed operational data across 15 regional distribution centers to identify bottlenecks, reducing average delivery time by 18%",
          "Developed a forecasting tool in Python that improved demand-planning accuracy from 72% to 89%",
          "Mentored 2 incoming analysts on client deliverable standards and internal modeling best practices",
        ],
      },
    ],
    leadership: [
      {
        id: newId(),
        org: "Big Brothers Big Sisters of Greater Los Angeles",
        role: "Volunteer Mentor",
        location: "Los Angeles, CA",
        dates: "Sep 2019 - Present",
        bullets: [
          "Mentor a high-school student weekly on academic planning and college applications",
        ],
      },
    ],
    skillsAndInterests: {
      skills: ["SQL", "Python", "Tableau", "Advanced Excel/VBA"],
      languages: ["Spanish (fluent)"],
      interests: ["Marathon running", "Amateur photography", "Chess"],
    },
  };
}

export function mockTailoringNotes(): string[] {
  return [
    "Mock mode: set ANTHROPIC_API_KEY or OPENAI_API_KEY (and remove MOCK_LLM=1) to generate real, job-tailored content.",
    "Reordered and re-emphasized bullets that resemble common job-posting keywords (this is sample output, not a real AI tailoring pass).",
  ];
}
