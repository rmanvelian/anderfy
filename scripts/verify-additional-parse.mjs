/**
 * Ensure Anderson-style ADDITIONAL sections parse into skillsAndInterests.
 * Run: node --experimental-strip-types scripts/verify-additional-parse.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Load via ts strip-types by dynamic import of the .ts file with a small
// alias shim — heuristicResume uses @/ imports, so inline a minimal runner
// that duplicates only the public extract after compiling through next isn't
// available. Instead, spawn tsc-free import with a custom resolve hook.

const templateStyle = `
YOUR NAME
(310) 555-0100 | first.last.2026@anderson.ucla.edu | linkedin.com/in/yourname
EDUCATION
UCLA Anderson School of Management
Los Angeles, CA
M.B.A., Full-Time Program
June 2027
Honors: Dean's List
EXPERIENCE
Acme Corp
Los Angeles, CA
Software Engineering Intern
June 2024 - August 2024
Built an internal dashboard used by 12 analysts
Shipped Y
ADDITIONAL Try to limit your bullets to 3-4 areas
Certifications: CFA, Series 63, Six Sigma Black Belt
Languages: Spanish, Farsi, Mandarin
Software: Java, CSS, Google Analytics, C/C++
Volunteer: Mentorship program
Interests: Chess, hiking, fintech podcasts
`;

const noHeaderLabeled = `
Jane Doe
jane@example.com
EXPERIENCE
Beta Inc
Engineer
2023 - 2024
Did things
Certifications: AWS Solutions Architect
Languages: English, French
Software: Python, SQL
Interests: Running
`;

const sameLineHeader = `
Sam Student
sam@ucla.edu
EDUCATION
UCLA
B.A., Economics
2024
EXPERIENCE
Corp
Analyst
2022 - 2023
Analyzed markets
ADDITIONAL Certifications: CFA Level I; Languages: Spanish; Software: Excel, Python; Interests: Soccer
`;

// Inline the critical path by importing compiled logic through a worker that
// registers a basic @/ → /workspace mapper.
import { register } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = "/workspace";

register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const mapped = ${JSON.stringify(root)} + "/" + specifier.slice(2);
      return nextResolve(mapped.endsWith(".ts") || mapped.endsWith(".js") ? mapped : mapped + ".ts", context);
    }
    return nextResolve(specifier, context);
  }
`));

const { extractResumeHeuristically } = await import("../lib/heuristicResume.ts");

function assertAdditional(resume, label) {
  const s = resume.skillsAndInterests;
  const count =
    (s.certifications?.length ?? 0) +
    (s.languages?.length ?? 0) +
    (s.software?.length ?? 0) +
    (s.volunteer?.length ?? 0) +
    (s.interests?.length ?? 0);
  assert.ok(count > 0, `${label}: expected Additional items, got ${JSON.stringify(s)}`);
  return s;
}

{
  const resume = extractResumeHeuristically(templateStyle);
  const s = assertAdditional(resume, "template-style");
  assert.ok(s.certifications.some((c) => /CFA/i.test(c)), `certs: ${s.certifications}`);
  assert.ok(s.languages.some((c) => /Spanish/i.test(c)), `langs: ${s.languages}`);
  assert.ok(s.software.some((c) => /Java/i.test(c)), `software: ${s.software}`);
  assert.ok(s.interests.some((c) => /Chess/i.test(c)), `interests: ${s.interests}`);
  // Guidance text must not become a software item
  assert.ok(!s.software.some((c) => /try to limit/i.test(c)), `no guidance in software: ${s.software}`);
}

{
  const resume = extractResumeHeuristically(noHeaderLabeled);
  const s = assertAdditional(resume, "no-header-labeled");
  assert.ok(s.certifications.length >= 1, JSON.stringify(s));
  assert.ok(s.languages.length >= 1, JSON.stringify(s));
  // Those rows should not remain as fake experience companies
  assert.ok(
    !resume.experience.some((e) => /certifications?/i.test(e.company)),
    `experience still has skill company: ${JSON.stringify(resume.experience)}`
  );
}

{
  const resume = extractResumeHeuristically(sameLineHeader);
  const s = assertAdditional(resume, "same-line-header");
  assert.ok(s.certifications.length >= 1 || s.software.length >= 1, JSON.stringify(s));
}

console.log("verify-additional-parse: all assertions passed");
console.log(
  "template-style skills:",
  extractResumeHeuristically(templateStyle).skillsAndInterests
);
