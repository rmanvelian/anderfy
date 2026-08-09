"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobStep } from "@/components/wizard/JobStep";
import { ReviewStep } from "@/components/wizard/ReviewStep";
import { SourceStep } from "@/components/wizard/SourceStep";
import { WizardStepper, type WizardStepKey } from "@/components/wizard/WizardStepper";
import { clearDraft, loadDraft, saveDraft } from "@/lib/storage";
import { createEmptyResumeData, type JobPosting, type ResumeData, type TailorResult } from "@/types/resume";

export default function BuildPage() {
  const [step, setStep] = useState<WizardStepKey>("source");
  const [resume, setResume] = useState<ResumeData>(createEmptyResumeData());
  const [jobPosting, setJobPosting] = useState<JobPosting>({ rawText: "" });
  const [notes, setNotes] = useState<string[] | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  // One-time sync from localStorage (an external system) on mount, before any
  // interactive rendering happens — see `hydrated` gating below.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setResume(draft.resume);
      setJobPosting(draft.jobPosting);
      setNotes(draft.notes);
      setStep(draft.step);
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ resume, jobPosting, notes, step });
  }, [hydrated, resume, jobPosting, notes, step]);

  const handleStartOver = () => {
    clearDraft();
    setResume(createEmptyResumeData());
    setJobPosting({ rawText: "" });
    setNotes(undefined);
    setStep("source");
  };

  const handleTailored = (result: TailorResult) => {
    setResume(result.resume);
    setNotes(result.notes);
    setStep("review");
  };

  if (!hydrated) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="size-5 text-ucla-blue" />
          Anderfy
        </Link>
        <Button variant="ghost" size="sm" onClick={handleStartOver}>
          Start over
        </Button>
      </div>

      <WizardStepper current={step} />

      {step === "source" && (
        <SourceStep
          onResumeReady={(nextResume) => {
            setResume(nextResume);
            setStep("job");
          }}
        />
      )}

      {step === "job" && (
        <JobStep
          resume={resume}
          jobPosting={jobPosting}
          onJobPostingChange={setJobPosting}
          onTailored={handleTailored}
          onSkipTailoring={() => setStep("review")}
          onBack={() => setStep("source")}
        />
      )}

      {step === "review" && (
        <ReviewStep
          resume={resume}
          jobPosting={jobPosting}
          notes={notes}
          onChange={setResume}
          onRetailor={() => setStep("job")}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}
