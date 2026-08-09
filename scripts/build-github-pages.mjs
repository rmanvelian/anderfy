#!/usr/bin/env node
/**
 * Build a static export for GitHub Pages.
 *
 * Next.js `output: "export"` cannot include App Router Route Handlers, so this
 * script temporarily moves `app/api` aside for the pages build, then restores it.
 * The browser wizard already falls back to in-browser parse/tailor/export when
 * `/api/*` is unavailable, so the static site stays functional.
 */
import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "app", "api");
const apiPark = join(root, ".api-park");
const outDir = join(root, "out");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

let parked = false;
try {
  if (existsSync(apiDir)) {
    if (existsSync(apiPark)) rmSync(apiPark, { recursive: true, force: true });
    renameSync(apiDir, apiPark);
    parked = true;
    console.log("Parked app/api for static export.");
  }

  run("npx", ["next", "build"], {
    GITHUB_PAGES: "1",
    GITHUB_PAGES_REPO: process.env.GITHUB_PAGES_REPO || "anderfy",
  });

  if (!existsSync(join(outDir, "index.html"))) {
    console.error("Static export failed: out/index.html was not produced.");
    process.exit(1);
  }

  // GitHub Pages serves 404.html for unknown SPA-ish paths on project sites.
  cpSync(join(outDir, "index.html"), join(outDir, "404.html"));
  console.log("GitHub Pages static export ready in out/ (includes index.html).");
} finally {
  if (parked && existsSync(apiPark)) {
    if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true });
    renameSync(apiPark, apiDir);
    console.log("Restored app/api.");
  }
}
