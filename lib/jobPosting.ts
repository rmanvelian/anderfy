import * as cheerio from "cheerio";

/**
 * Best-effort fetch + text extraction for a job posting URL. Many job boards
 * (LinkedIn, Indeed, etc.) block server-side requests or require JS rendering,
 * so this is a convenience path only — pasting the job description text
 * remains the reliable option and is offered alongside this in the UI.
 */
export async function fetchJobPostingText(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Only http(s) URLs are supported.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AnderfyBot/1.0; +https://anderfy.app) resume-tailoring-assistant",
      Accept: "text/html",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Couldn't fetch that page (HTTP ${response.status}). Try pasting the job description text instead.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("That URL doesn't look like a web page. Try pasting the job description text instead.");
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav").remove();

  const text = $("body").text().replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const cleaned = lines.join("\n");

  if (cleaned.length < 100) {
    throw new Error(
      "Couldn't extract meaningful text from that page (it may require JavaScript). Try pasting the job description text instead."
    );
  }

  return cleaned.slice(0, 20000);
}
