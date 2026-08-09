/**
 * Prefix for fetch() calls when the app is hosted under a subpath
 * (GitHub Pages project site: /anderfy). Next.js Link/router handle basePath
 * automatically; raw fetch() does not.
 */
export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}
