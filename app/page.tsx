import { FileEdit, FileOutput, GraduationCap, Sparkles, Target, Upload } from "lucide-react";
import { HeroCta, BUILD_SECTION_ID } from "@/components/landing/HeroCta";
import { BuildWizard } from "@/components/wizard/BuildWizard";
import { Card, CardContent } from "@/components/ui/card";

function SectionGoldDivider() {
  return (
    <div className="relative z-10 -my-px w-full" aria-hidden="true">
      <div className="h-0.5 w-full bg-ucla-gold" />
    </div>
  );
}

const FEATURES = [
  {
    icon: Upload,
    title: "Supports multiple upload types",
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
      {/* UCLA Brand Gradient (Darker Blue -> UCLA Blue), stopping short of Lighter
          Blue wherever headline text sits so contrast stays safely high. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ucla-darkest-blue via-ucla-blue to-ucla-blue">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 pt-20 pb-0 text-center sm:px-6">
          <h1 className="flex w-full max-w-4xl flex-col gap-4 text-ucla-gold sm:gap-5">
            <span className="text-6xl sm:text-7xl">Anderfy</span>
            <span className="text-[clamp(1.35rem,3.8vw,2.25rem)] font-normal whitespace-nowrap">
              An AI-Powered Anderson Resume Builder
            </span>
          </h1>
          <p className="max-w-2xl text-lg text-white/85 sm:text-xl">
            Anderfy turns your background into a polished, one-page resume in the UCLA Anderson format,
            tailored to a specific job posting.
          </p>
        </div>
        {/* Center the CTA in the space between the supporting copy and the section divider. */}
        <div className="flex items-center justify-center py-10 sm:py-12">
          <HeroCta />
        </div>
      </section>

      <SectionGoldDivider />

      <section className="bg-muted">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl text-ucla-blue sm:text-3xl">The Anderfy Advantage</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="flex flex-col gap-2 pt-2">
                  <feature.icon className="size-5 text-ucla-blue" />
                  <h3 className="text-base">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <SectionGoldDivider />

      <section
        id={BUILD_SECTION_ID}
        aria-label="Build your Anderson resume"
        className="scroll-mt-6 bg-gradient-to-b from-ucla-darkest-blue via-ucla-blue to-ucla-blue"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl text-ucla-gold sm:text-3xl">Anderfy Your Resume</h2>
            <p className="mt-2 text-white/85">
              Upload or paste your background, add a job posting, then review and export.
            </p>
          </div>
          <div className="rounded-xl bg-white p-4 text-foreground shadow-sm sm:p-6">
            <BuildWizard />
          </div>
        </div>
      </section>
    </div>
  );
}
