import { NextResponse } from "next/server";

/**
 * CORS for browser calls from the GitHub Pages UI to a Vercel (or other)
 * API host. Set CORS_ALLOWED_ORIGINS to a comma-separated list, e.g.
 * `https://rmanvelian.github.io,http://localhost:3000`.
 * When unset, reflecting the request Origin is allowed only in development.
 */
function allowedOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function corsHeadersForRequest(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && allowed.includes(origin.replace(/\/$/, ""))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else if (origin && process.env.NODE_ENV !== "production" && allowed.length === 0) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

export function withCors(request: Request, response: NextResponse): NextResponse {
  const cors = corsHeadersForRequest(request);
  for (const [key, value] of Object.entries(cors)) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsPreflight(request: Request): NextResponse {
  return withCors(request, new NextResponse(null, { status: 204 }));
}
