"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { parseResumeClient } from "@/lib/clientResume";
import { createEmptyResumeData, type ResumeData } from "@/types/resume";

export function SourceStep({
  onResumeReady,
}: {
  onResumeReady: (resume: ResumeData) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadSubmit = async () => {
    if (!file) {
      setError("Choose a resume file first (PDF, DOCX, or TXT).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resume = await parseResumeClient({ file });
      onResumeReady(resume);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim() || pastedText.trim().length < 30) {
      setError("Paste a bit more text about your background first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resume = await parseResumeClient({ text: pastedText });
      onResumeReady(resume);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-2">
        <div>
          <span className="eyebrow">Step 1</span>
          <h2 className="mt-1 text-lg font-semibold">Tell us about your background</h2>
          <p className="text-sm text-muted-foreground">
            Upload an existing resume, paste some background text, or start from a blank page — we&apos;ll turn
            it into an Anderson-formatted resume next.
          </p>
        </div>

        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload resume</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
            <TabsTrigger value="blank">Start blank</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-accent/40"
            >
              <Upload className="size-6 text-muted-foreground" />
              {file ? (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="size-4" /> {file.name}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Click to choose a PDF, DOCX, or TXT file (max 10MB)
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button onClick={handleUploadSubmit} disabled={loading || !file} className="w-fit">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload
            </Button>
          </TabsContent>

          <TabsContent value="paste" className="flex flex-col gap-3">
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your resume text, LinkedIn 'About' + experience sections, or just a rough summary of your jobs and education..."
              className="min-h-40"
            />
            <Button onClick={handlePasteSubmit} disabled={loading} className="w-fit">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Parse my background
            </Button>
          </TabsContent>

          <TabsContent value="blank" className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Start with a completely blank resume and fill in your education, experience, and activities
              yourself in the next steps.
            </p>
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => onResumeReady(createEmptyResumeData())}
            >
              Start blank
            </Button>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t process that</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
