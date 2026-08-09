"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AdditionalEditor } from "@/components/resume/editor/AdditionalEditor";
import { ContactFields } from "@/components/resume/editor/ContactFields";
import { EducationEditor } from "@/components/resume/editor/EducationEditor";
import { ExperienceEditor } from "@/components/resume/editor/ExperienceEditor";
import { LeadershipEditor } from "@/components/resume/editor/LeadershipEditor";
import type { ResumeData } from "@/types/resume";

export function ResumeEditor({
  resume,
  onChange,
}: {
  resume: ResumeData;
  onChange: (next: ResumeData) => void;
}) {
  return (
    <Accordion multiple defaultValue={["contact", "experience"]} className="w-full">
      <AccordionItem value="contact">
        <AccordionTrigger className="text-base font-semibold">Header &amp; contact</AccordionTrigger>
        <AccordionContent>
          <ContactFields
            contact={resume.contact}
            onChange={(contact) => onChange({ ...resume, contact })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="education">
        <AccordionTrigger className="text-base font-semibold">Education</AccordionTrigger>
        <AccordionContent>
          <EducationEditor
            entries={resume.education}
            onChange={(education) => onChange({ ...resume, education })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="experience">
        <AccordionTrigger className="text-base font-semibold">Experience</AccordionTrigger>
        <AccordionContent>
          <ExperienceEditor
            entries={resume.experience}
            onChange={(experience) => onChange({ ...resume, experience })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="leadership">
        <AccordionTrigger className="text-base font-semibold">Leadership &amp; activities</AccordionTrigger>
        <AccordionContent>
          <LeadershipEditor
            entries={resume.leadership}
            onChange={(leadership) => onChange({ ...resume, leadership })}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="additional">
        <AccordionTrigger className="text-base font-semibold">Additional (skills, languages, interests)</AccordionTrigger>
        <AccordionContent>
          <AdditionalEditor
            value={resume.skillsAndInterests}
            onChange={(skillsAndInterests) => onChange({ ...resume, skillsAndInterests })}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
