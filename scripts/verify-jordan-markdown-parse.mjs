/**
 * Jordan Alvarez markdown resume + Anderson PDF round-trip checks.
 * Run: node --experimental-strip-types scripts/verify-jordan-markdown-parse.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

const root = "/workspace";
register(
  "data:text/javascript," +
    encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const mapped = ${JSON.stringify(root)} + "/" + specifier.slice(2);
      return nextResolve(mapped.endsWith(".ts") || mapped.endsWith(".js") ? mapped : mapped + ".ts", context);
    }
    return nextResolve(specifier, context);
  }
`)
);

const { extractResumeHeuristically } = await import("../lib/heuristicResume.ts");
const { extractTextFromFile } = await import("../lib/parseFile.ts");

const mdPath = "/home/ubuntu/.cursor/projects/workspace/uploads/resume_9c47.md";
const correctPdf =
  "/home/ubuntu/.cursor/projects/workspace/uploads/Correct_Jordan_Alvarez_Anderson_Resume_c8fd.pdf";

{
  const md = readFileSync(mdPath, "utf8");
  const r = extractResumeHeuristically(md);

  assert.equal(r.contact.name, "Jordan Alvarez", `name: ${r.contact.name}`);
  assert.match(r.contact.email, /jordan\.alvarez/i);
  assert.ok(!/#/.test(r.contact.name), "name must not keep markdown #");

  assert.equal(r.experience.length, 3, `exp count: ${r.experience.length}`);
  assert.match(r.experience[0].company, /Meridian Cloud Systems/i);
  assert.match(r.experience[0].title, /Software Engineer/i);
  assert.match(r.experience[0].location, /Austin/i);
  assert.match(r.experience[0].startDate, /2022/i);
  assert.match(r.experience[0].endDate, /Present/i);
  assert.ok(r.experience[0].bullets.length >= 3, `meridian bullets: ${r.experience[0].bullets}`);

  assert.match(r.experience[1].company, /Fenwick/i);
  assert.match(r.experience[1].title, /Backend Developer/i);
  assert.match(r.experience[2].title, /Intern/i);

  assert.ok(
    !r.experience.some((e) => /summary|##|^\*\*/i.test(e.company + e.title)),
    `markdown noise in experience: ${JSON.stringify(r.experience)}`
  );

  assert.equal(r.education.length, 1, `edu count: ${r.education.length}`);
  assert.match(r.education[0].school, /University of Texas/i);
  assert.match(r.education[0].degree, /Computer Science/i);

  assert.ok(r.skillsAndInterests.languages.some((v) => /Python/i.test(v)));
  assert.ok(r.skillsAndInterests.software.some((v) => /Flask/i.test(v)));
  assert.ok(
    r.skillsAndInterests.software.some((v) => /AWS \(EC2,\s*S3,\s*RDS\)/i.test(v)),
    `AWS kept intact: ${JSON.stringify(r.skillsAndInterests.software)}`
  );
  assert.ok(
    !r.skillsAndInterests.languages.some((v) => /Frameworks\//i.test(v)),
    `languages leaked Frameworks/: ${JSON.stringify(r.skillsAndInterests.languages)}`
  );
}

{
  const buf = readFileSync(correctPdf);
  const text = await extractTextFromFile(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    "correct.pdf",
    "application/pdf"
  );
  const r = extractResumeHeuristically(text);

  assert.equal(r.contact.name, "Jordan Alvarez");
  assert.ok(r.education.length >= 2, `edu: ${JSON.stringify(r.education)}`);
  assert.ok(
    r.education.some((e) => /Anderson/i.test(e.school)),
    `Anderson school: ${JSON.stringify(r.education)}`
  );
  assert.ok(
    r.education.some((e) => /Texas|Austin/i.test(e.school)),
    `UT school: ${JSON.stringify(r.education)}`
  );
  assert.ok(
    !r.education.some((e) => /Los Angeles/i.test(e.school) && !/Anderson/i.test(e.school)),
    `location must not replace school name: ${JSON.stringify(r.education)}`
  );

  assert.ok(r.experience.length >= 3, `exp count ${r.experience.length}: ${JSON.stringify(r.experience)}`);
  assert.ok(
    r.experience.some((e) => /Meridian/i.test(e.company)),
    `Meridian company: ${JSON.stringify(r.experience)}`
  );
  assert.ok(
    !r.experience.some((e) => /reporting tool|product decisions|dashboard used/i.test(e.company)),
    `wrapped bullets must not become companies: ${JSON.stringify(r.experience.map((e) => e.company))}`
  );

  assert.ok(r.skillsAndInterests.certifications.some((v) => /CFA/i.test(v)));
  assert.ok(r.skillsAndInterests.volunteer.some((v) => /Animal Shelter/i.test(v)));
  assert.ok(r.skillsAndInterests.interests.some((v) => /hiking/i.test(v)));
}

console.log("verify-jordan-markdown-parse: all assertions passed");
