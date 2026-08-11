/**
 * Prefix for fetch() calls when the app is hosted under a subpath
 * (GitHub Pages project site: /anderfy). Next.js Link/router handle basePath
 * automatically; raw fetch() does not.
 *
 * Optional NEXT_PUBLIC_API_ORIGIN points at a Node host (e.g. Vercel) that runs
 * `/api/*` with the Claude/OpenAI keys — used so the static github.io UI can
 * still call real AI without embedding secrets in the browser bundle.
 */
export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

/** Absolute or same-origin URL for an API route. */
export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const origin = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");
  if (origin) return `${origin}${normalized}`;
  return withBasePath(normalized);
}

/** True when the client is configured to call a remote Node API (e.g. Vercel). */
export function hasRemoteApiOrigin(): boolean {
  return Boolean((process.env.NEXT_PUBLIC_API_ORIGIN || "").trim());
}
