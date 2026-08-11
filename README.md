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

### Deploying with Claude AI (recommended: Vercel)

**GitHub Pages cannot run Claude.** Pages only serves static files — there is no Node
server, so `/api/parse-resume` and `/api/tailor` do not exist there, and an
`ANTHROPIC_API_KEY` cannot be kept secret in the browser. Localhost works because
`next dev` runs those API routes with keys from `.env.local`.

To get the same AI behavior as localhost on a public URL:

1. Import this repo in [Vercel](https://vercel.com) (Framework Preset: Next.js).
2. In Vercel → Project → Settings → Environment Variables, add:
   - `ANTHROPIC_API_KEY` = your key (Production + Preview)
   - Optional: `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `LLM_PROVIDER`
3. Deploy. Use the `*.vercel.app` URL (or a custom domain) for AI-powered builds.

Do **not** put the API key in `NEXT_PUBLIC_*` variables.

### Optional: keep github.io UI, call Vercel for AI

If you want the GitHub Pages site to use Claude without moving the UI off github.io:

1. Deploy the full Next.js app to Vercel with `ANTHROPIC_API_KEY` as above.
2. On Vercel, also set  
   `CORS_ALLOWED_ORIGINS=https://<your-user>.github.io,http://localhost:3000`
3. In the GitHub repo, add Actions secret  
   `NEXT_PUBLIC_API_ORIGIN=https://your-app.vercel.app`  
   (the static Pages workflow passes this into `build:pages`).
4. Redeploy Pages. The static UI will POST to Vercel for parse/tailor; Submit should
   show a real delay while Claude runs.

Without `NEXT_PUBLIC_API_ORIGIN`, github.io stays in **heuristic-only** mode (instant
Submit, no AI rewrite). The wizard shows a banner when that mode is active.

### Deploying to GitHub Pages (static / no AI by default)

There is no checked-in root `index.html` — Anderfy is a Next.js app. For GitHub Pages,
build a **static export** that produces `out/index.html`:

```bash
npm run build:pages
```

That script:
1. Temporarily parks `app/api` (Route Handlers can't be statically exported)
2. Runs `next build` with `output: "export"` and `basePath` set to `/<repo-name>`
3. Writes the site into `out/` (including `index.html` and a `404.html` fallback)
4. Restores `app/api` for normal local/server development

A GitHub Actions workflow (`.github/workflows/static.yml`) runs this on pushes to
`main` and deploys the `out/` folder to GitHub Pages (not the repo root / README).

**Enable Pages in the repo:** Settings → Pages → Source: **GitHub Actions**.

**What works on GitHub Pages alone:** upload/paste → heuristic parse/tailor → edit →
PDF/DOCX export in the browser. Live Claude/OpenAI needs Vercel (or another Node host)
as described above.

### Choosing an AI provider

`lib/llmClient.ts` auto-detects which provider to use: **Anthropic's Claude Sonnet 5** if
`ANTHROPIC_API_KEY` is set, otherwise **OpenAI** if `OPENAI_API_KEY` is set. Set `LLM_PROVIDER=anthropic` or
`LLM_PROVIDER=openai` to force one explicitly. Both providers use native structured-output support (zod
schema in, validated object out) rather than hand-rolled JSON parsing.

### Running without an API key (free local mode)

Set `MOCK_LLM=1` in your environment (see `.env.example`) to skip paid LLM calls entirely. `lib/llm.ts`
also automatically falls back to this mode if neither `ANTHROPIC_API_KEY` nor `OPENAI_API_KEY` is set.

This is **not** canned placeholder data — `lib/heuristicResume.ts` runs a zero-cost, regex/layout-based
parser and tailoring pass over the resume and job posting you actually provide:

- **Parsing**: detects resume sections (education/experience/additional), groups lines into entries, and
  pulls out dates, locations, titles, GPA/honors (as education bullets), etc. from your real
  uploaded/pasted text. A legacy "Leadership" header is folded into Additional → Volunteer.
- **Tailoring**: extracts the most frequent meaningful keywords from the job posting and reorders your
  existing bullets and Additional items (most relevant first) by keyword overlap — it never rewrites or
  invents content the way an LLM would, but it's real output for your real input.

Configure a real `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to additionally get AI-rewritten, keyword-echoing
bullets rather than just reordering.

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
  heuristicResume.ts       free local parse/tailor used when no API key / MOCK_LLM=1
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
