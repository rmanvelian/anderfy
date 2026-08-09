# Anderfy — Anderson-Format Resume Builder

Anderfy turns a candidate's background — an existing resume, some pasted background text, or a completely
blank slate — into a resume formatted the way UCLA Anderson School of Management's Parker Career
Management Center (Parker CMC) recommends, tailored to a specific job posting.

> **Note on the "Anderson format":** the official Parker CMC resume template is a proprietary document
> distributed privately to admitted Anderson students and isn't publicly downloadable. This app implements
> a best-effort recreation based on Anderson's own published guidance (one page, conservative business
> formatting, reverse-chronological, S-T-A-R bullets) and common top-MBA resume conventions. If you have
> access to the real template, the layout in `components/resume/AndersonResumeDocument.tsx` (and its DOCX
> counterpart in `lib/docx-export.ts`) can be adjusted to match it more closely.

## How it works

1. **Your background** — upload a resume (PDF/DOCX/TXT), paste rough background text, or start from a
   blank page.
2. **Job posting** — paste a job description (or a URL, fetched best-effort) to tailor against.
3. **Review & export** — an AI pass rewrites/reprioritizes your bullets in the Anderson structure; edit
   anything inline, then download a matching PDF or an editable DOCX.

There's no login and no server-side database — your draft is kept in your browser's `localStorage`.

## No fabricated facts, by construction

Tailoring is deliberately scoped so the model can't introduce new facts about the candidate:

- The AI is only ever allowed to (a) choose which existing education/experience entries to feature and in
  what order, and (b) rewrite those entries' bullets. It never controls factual fields — company, school,
  title, dates, location, contact info always come straight from the user's original resume
  (`lib/tailorMerge.ts`), so the model has no channel through which to rename/invent an employer or degree.
- Every rewritten bullet is checked against the original bullets it's replacing
  (`lib/numberGuard.ts`): if it contains a number (a percentage, dollar figure, team size, etc.) that
  doesn't appear anywhere in the source bullets, the rewrite is discarded and the original bullet is kept
  instead.
- `skillsAndInterests` values proposed by the model are filtered to only those that already exist
  (verbatim) in the user's original list.
- The job posting is passed to the model purely as *context* for what to emphasize — the prompt explicitly
  states it is never a source of facts about the candidate.

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**
- **Claude Sonnet 5 (Anthropic) or OpenAI** for resume parsing and job-tailored rewriting — see
  `lib/llmClient.ts` (provider selection + structured-output calls) and `lib/llm.ts` (prompts/schemas)
- **`@react-pdf/renderer`** renders the resume for both the on-screen preview and the downloaded PDF, so
  they're always in sync (`components/resume/AndersonResumeDocument.tsx`)
- **`docx`** generates an editable Word version with equivalent structure/styling (`lib/docx-export.ts`)
- **`unpdf` / `mammoth`** extract text from uploaded PDF/DOCX resumes
- **`cheerio`** does best-effort text extraction when fetching a job posting URL

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Choosing an AI provider

`lib/llmClient.ts` auto-detects which provider to use: **Anthropic's Claude Sonnet 5** if
`ANTHROPIC_API_KEY` is set, otherwise **OpenAI** if `OPENAI_API_KEY` is set. Set `LLM_PROVIDER=anthropic` or
`LLM_PROVIDER=openai` to force one explicitly. Both providers use native structured-output support (zod
schema in, validated object out) rather than hand-rolled JSON parsing.

### Running without an API key

Set `MOCK_LLM=1` in your environment (see `.env.example`) to bypass real AI calls entirely and use
deterministic mock data for resume parsing/tailoring. This is useful for exercising the upload → edit →
export pipeline without a live API key. `lib/llm.ts` also automatically falls back to mock mode if neither
`ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` is set.

**Important:** in mock mode, the app always returns the same fixed sample resume ("Jordan Rivera") no
matter what you upload or paste — that's expected in mock mode, but if you have a real API key configured
and are still seeing generic/sample output instead of your own data, double-check `MOCK_LLM` isn't set to
`1` somewhere in your environment.

## Project structure

```
app/
  page.tsx                landing page
  build/page.tsx           the wizard (source -> job posting -> review/export)
  api/parse-resume/        POST: extract text from an upload/paste, then LLM-structure it
  api/tailor/              POST: tailor a structured resume to a job posting
  api/job-posting/fetch/   POST: best-effort fetch + text-extract a job posting URL
  api/export/pdf/          POST: render a ResumeData into a downloadable PDF
  api/export/docx/         POST: render a ResumeData into a downloadable DOCX
components/
  resume/                  the Anderson-format PDF template, PDF preview, and structured editor
  wizard/                  the three wizard steps + stepper
lib/
  llmClient.ts             provider-agnostic structured LLM calls (Anthropic Claude Sonnet 5 / OpenAI)
  llm.ts                   prompts, schemas, and mock-mode fallback for parsing/tailoring
  tailorMerge.ts           merges AI-proposed bullets/order back onto the original resume's facts
  numberGuard.ts           flags/reverts bullets that introduce an unverified number
  parseFile.ts             PDF/DOCX -> raw text extraction
  docx-export.ts           ResumeData -> .docx buffer
  pageFit.ts                heuristic one-page-length estimator
  storage.ts               localStorage draft persistence
types/resume.ts             shared ResumeData / JobPosting types
```

## Design language

The app's own UI (not the generated resume, which stays conservative black-and-white per the Anderson
format) is styled to feel like an extension of [anderson.ucla.edu](https://www.anderson.ucla.edu/): Open
Sans (the same fallback the Anderson site uses for its licensed "freight-sans-pro"), muted charcoal body
text rather than pure black, UCLA Blue reserved for links/accents/buttons, light-gray alternating section
backgrounds, bold sans-serif headings, pill-shaped buttons, and small uppercase "eyebrow" labels — all
patterns pulled directly from the Anderson site's own stylesheet.
