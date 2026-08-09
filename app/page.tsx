import Link from "next/link";
import { FileEdit, FileOutput, GraduationCap, Sparkles, Target, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Upload,
    title: "Start anywhere",
    description:
      "Upload an existing resume (PDF/DOCX), paste rough background text, or start from a completely blank page.",
  },
  {
    icon: Target,
    title: "Tailored to the job",
    description:
      "Paste a job posting and your bullets get reprioritized and rewritten with S-T-A-R phrasing that echoes what the role is looking for.",
  },
  {
    icon: GraduationCap,
    title: "Anderson format",
    description:
      "Structured the way UCLA Anderson's Parker Career Management Center recommends: one page, conservative, reverse-chronological.",
  },
  {
    icon: FileEdit,
    title: "You stay in control",
    description: "Every AI-generated section is fully editable before you export — nothing is locked in.",
  },
  {
    icon: FileOutput,
    title: "Export instantly",
    description: "Download a polished PDF or an editable DOCX, styled consistently with your on-screen preview.",
  },
  {
    icon: Sparkles,
    title: "No account needed",
    description: "Your draft lives in your browser — no sign-up, no server-side storage.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          <GraduationCap className="size-3.5" />
          UCLA Anderson-style resume format
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Build an Anderson-formatted resume, tailored to the job you want
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Anderfy turns your background — an existing resume or just a rough summary — into a polished,
          one-page resume in the UCLA Anderson / Parker Career Management Center style, tailored to a specific
          job posting.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/build" />} nativeButton={false} size="lg">
            Get started
          </Button>
        </div>
        <p className="max-w-xl text-xs text-muted-foreground">
          This is a best-effort recreation of Anderson&apos;s published formatting guidance — the official Parker
          CMC template is distributed privately to admitted students and isn&apos;t publicly available.
        </p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="flex flex-col gap-2 pt-2">
                <feature.icon className="size-5 text-primary" />
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
