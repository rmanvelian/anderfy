"use client";

import { useState } from "react";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobPosting, ResumeData } from "@/types/resume";

export function JobStep({
  resume,
  jobPosting,
  onJobPostingChange,
  onTailored,
  onSkipTailoring,
  onBack,
}: {
  resume: ResumeData;
  jobPosting: JobPosting;
  onJobPostingChange: (next: JobPosting) => void;
  onTailored: (resume: ResumeData) => void;
  onSkipTailoring: () => void;
  onBack: () => void;
}) {
  const [url, setUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumeHasContent =
    resume.experience.length > 0 || resume.education.length > 0 || !!resume.contact.name?.trim();

  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    setFetchingUrl(true);
    setError(null);
    try {
      const res = await fetch("/api/job-posting/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't fetch that URL.");
      onJobPostingChange({ ...jobPosting, rawText: data.text });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleTailor = async () => {
    if (!jobPosting.rawText.trim() || jobPosting.rawText.trim().length < 30) {
      setError("Paste a bit more of the job description first.");
      return;
    }
    setTailoring(true);
    setError(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resume, jobPosting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to tailor your resume.");
      onTailored(data.resume as ResumeData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setTailoring(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-2">
        <div>
          <h2 className="text-lg font-semibold">Paste the target job posting</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll prioritize and rewrite your bullets to align with this posting&apos;s language and
            requirements, then format everything the Anderson way.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Job title (optional)</Label>
            <Input
              value={jobPosting.title || ""}
              onChange={(e) => onJobPostingChange({ ...jobPosting, title: e.target.value })}
              placeholder="Senior Product Manager"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Company (optional)</Label>
            <Input
              value={jobPosting.company || ""}
              onChange={(e) => onJobPostingChange({ ...jobPosting, company: e.target.value })}
              placeholder="Acme Corp"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Job posting URL (best-effort fetch, optional)</Label>
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://company.com/careers/senior-product-manager"
            />
            <Button type="button" variant="outline" onClick={handleFetchUrl} disabled={fetchingUrl || !url.trim()}>
              {fetchingUrl ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              Fetch
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Many job boards block automated fetches — pasting the text below is the most reliable option.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Job description</Label>
          <Textarea
            value={jobPosting.rawText}
            onChange={(e) => onJobPostingChange({ ...jobPosting, rawText: e.target.value })}
            placeholder="Paste the full job description here..."
            className="min-h-56"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t continue</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!resumeHasContent && (
          <Alert>
            <AlertTitle>Your resume is currently empty</AlertTitle>
            <AlertDescription>
              You can still tailor now (nothing to rewrite yet) or fill in your background in the next step first,
              then come back and tailor.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button variant="outline" onClick={onSkipTailoring}>
            Skip — edit manually
          </Button>
          <Button onClick={handleTailor} disabled={tailoring}>
            {tailoring ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Tailor my resume
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
