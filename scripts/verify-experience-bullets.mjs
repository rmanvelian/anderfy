/**
 * Assertions for experience bullet floor + balance rules.
 * Mirrors lib/experienceBullets.ts + the merge empty-proposal guard.
 * Run: node scripts/verify-experience-bullets.mjs
 */
import assert from "node:assert/strict";

function nonEmpty(bullets) {
  return (bullets ?? []).map((b) => b.trim()).filter(Boolean);
}

function experienceKey(entry) {
  return `${entry.company.trim().toLowerCase()}::${entry.title.trim().toLowerCase()}`;
}

function restoreEmptyExperienceBullets(tailored, source) {
  const sourceById = new Map(source.experience.map((e) => [e.id, e]));
  const sourceByKey = new Map(source.experience.map((e) => [experienceKey(e), e]));
  return {
    ...tailored,
    experience: tailored.experience.map((entry) => {
      const original = sourceById.get(entry.id) ?? sourceByKey.get(experienceKey(entry));
      const sourceBullets = nonEmpty(original?.bullets);
      const currentBullets = nonEmpty(entry.bullets);
      if (sourceBullets.length > 0 && currentBullets.length === 0) {
        return { ...entry, bullets: [...sourceBullets] };
      }
      return { ...entry, bullets: currentBullets };
    }),
  };
}

function balanceExperienceBulletCounts(resume) {
  const experience = resume.experience.map((e) => ({
    ...e,
    bullets: nonEmpty(e.bullets),
  }));

  let guard = 100;
  while (guard-- > 0) {
    const active = experience
      .map((e, index) => ({ e, index, n: e.bullets.length }))
      .filter((x) => x.n > 0);
    if (active.length <= 1) break;

    const min = Math.min(...active.map((x) => x.n));
    const max = Math.max(...active.map((x) => x.n));
    if (max - min <= 1) break;

    const atMax = active.filter((x) => x.n === max);
    atMax.sort((a, b) => b.index - a.index);
    const target = atMax[0];
    if (!target || target.n <= 1) break;
    target.e.bullets.pop();
  }

  return { ...resume, experience };
}

function normalizeExperienceBullets(tailored, source) {
  return balanceExperienceBulletCounts(restoreEmptyExperienceBullets(tailored, source));
}

function trimOneBalancedExperienceBullet(experience) {
  const active = experience
    .map((e, index) => ({ e, index, n: e.bullets.length }))
    .filter((x) => x.n > 0);
  if (active.length === 0) return false;

  const min = Math.min(...active.map((x) => x.n));
  const aboveMin = active.filter((x) => x.n > min && x.n > 1);
  const tiedAllAboveOne = active.every((x) => x.n > 1) ? active : [];
  const pool = aboveMin.length > 0 ? aboveMin : tiedAllAboveOne;
  if (pool.length === 0) return false;

  pool.sort((a, b) => b.index - a.index);
  pool[0].e.bullets.pop();
  return true;
}

function mergeKeepSourceOnEmpty(sourceBullets, proposedBullets) {
  const source = (sourceBullets || []).filter((b) => b && b.trim());
  const proposed = (proposedBullets || []).filter((b) => b && b.trim());
  if (source.length === 0) return [];
  if (proposed.length === 0) return source;
  return proposed;
}

function role(id, company, title, bullets) {
  return { id, company, title, bullets };
}

function resume(experience) {
  return { experience };
}

{
  const source = resume([
    role("a", "Acme", "SWE Intern", ["Built X", "Shipped Y"]),
    role("b", "Beta", "Analyst", ["Did A", "Did B", "Did C"]),
  ]);
  const tailored = resume([
    role("a", "Acme", "SWE Intern", []),
    role("b", "Beta", "Analyst", ["Did A", "Did B", "Did C", "Did D"]),
  ]);
  const out = normalizeExperienceBullets(tailored, source);
  assert.ok(out.experience[0].bullets.length >= 1, "intern must not stay empty");
  const counts = out.experience.map((e) => e.bullets.length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `balanced after restore: ${counts}`);
}

{
  const r = resume([
    role("a", "A", "T1", ["1", "2", "3", "4", "5"]),
    role("b", "B", "T2", ["1", "2", "3", "4"]),
    role("c", "C", "T3", ["1", "2", "3"]),
  ]);
  const out = balanceExperienceBulletCounts(r);
  const counts = out.experience.map((e) => e.bullets.length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `5/4/3 → ${counts}`);
  // Prefer keeping the +1 on more recent roles: 4/4/3 (not 5/4/3).
  assert.deepEqual(counts, [4, 4, 3]);
}

{
  assert.deepEqual(mergeKeepSourceOnEmpty(["Built X", "Shipped Y"], []), ["Built X", "Shipped Y"]);
}

{
  const experience = [role("a", "A", "T1", ["1"]), role("b", "B", "T2", ["1"])];
  assert.equal(trimOneBalancedExperienceBullet(experience), false);
}

{
  const source = resume([role("old", "Acme", "SWE Intern", ["Built X", "Shipped Y"])]);
  const tailored = resume([role("new", "Acme", "SWE Intern", [])]);
  const out = restoreEmptyExperienceBullets(tailored, source);
  assert.equal(out.experience[0].bullets.length, 2);
}

// Page-fit must not wipe Additional categories down to zero.
{
  function cloneSkills(s) {
    return {
      certifications: [...(s.certifications ?? [])],
      languages: [...(s.languages ?? [])],
      software: [...(s.software ?? [])],
      volunteer: [...(s.volunteer ?? [])],
      interests: [...(s.interests ?? [])],
    };
  }

  function trimAdditionalExtras(skills) {
    const order = ["interests", "volunteer", "software", "languages", "certifications"];
    for (const key of order) {
      const list = skills[key];
      if (list && list.length > 1) {
        list.pop();
        return true;
      }
    }
    return false;
  }

  const skills = cloneSkills({
    certifications: ["CPA"],
    languages: ["English", "Spanish"],
    software: ["Python", "Excel", "SQL", "Tableau"],
    volunteer: ["Tutor"],
    interests: ["Chess", "Hiking"],
  });

  // Simulate aggressive trim: only extras may be removed.
  let guard = 50;
  while (guard-- > 0 && trimAdditionalExtras(skills)) {
    /* keep shortening */
  }

  assert.ok(skills.certifications.length >= 1);
  assert.ok(skills.languages.length >= 1);
  assert.ok(skills.software.length >= 1);
  assert.ok(skills.volunteer.length >= 1);
  assert.ok(skills.interests.length >= 1);
  assert.equal(skills.software.length, 1);
  assert.equal(skills.languages.length, 1);
}

console.log("verify-experience-bullets: all assertions passed");
