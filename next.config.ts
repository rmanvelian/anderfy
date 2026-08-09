import type { NextConfig } from "next";

// GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
// so static exports need a matching basePath. Local `next dev` / `next start`
// stay at the domain root.
const isGithubPages = process.env.GITHUB_PAGES === "1";
const repoName = process.env.GITHUB_PAGES_REPO || "anderfy";
const basePath = isGithubPages ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: `${basePath}/`,
        trailingSlash: true,
      }
    : {}),
  // Required for static export; harmless for server builds.
  images: { unoptimized: true },
  // Expose basePath to client fetch() helpers (Link/router already know it).
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
