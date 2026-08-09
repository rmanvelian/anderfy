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

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**
- **OpenAI API** for resume parsing and job-tailored rewriting (see `lib/llm.ts`)
- **`@react-pdf/renderer`** renders the resume for both the on-screen preview and the downloaded PDF, so
  they're always in sync (`components/resume/AndersonResumeDocument.tsx`)
- **`docx`** generates an editable Word version with equivalent structure/styling (`lib/docx-export.ts`)
- **`unpdf` / `mammoth`** extract text from uploaded PDF/DOCX resumes
- **`cheerio`** does best-effort text extraction when fetching a job posting URL

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in OPENAI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running without an OpenAI key

Set `MOCK_LLM=1` in your environment (see `.env.example`) to bypass the OpenAI API and use deterministic
sample data for resume parsing/tailoring. This is useful for exercising the upload → edit → export pipeline
without a live API key. `lib/llm.ts` also automatically falls back to mock mode if `OPENAI_API_KEY` isn't
set at all.

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
  llm.ts                   OpenAI wrapper (+ mock mode) for parsing/tailoring
  parseFile.ts             PDF/DOCX -> raw text extraction
  docx-export.ts           ResumeData -> .docx buffer
  pageFit.ts                heuristic one-page-length estimator
  storage.ts               localStorage draft persistence
types/resume.ts             shared ResumeData / JobPosting types
```
