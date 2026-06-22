/**
 * email-utils.ts
 *
 * Shared helpers for rendering email content safely and legibly.
 *
 * Why this file exists: the raw `msg.body` coming back from the API is
 * inconsistent — sometimes clean plaintext, sometimes a plaintext dump of an
 * HTML email (full of "----------" artifacts and raw tracking URLs),
 * and sometimes literal unparsed HTML source (e.g. "<!DOCTYPE html>...").
 * Every place that displays an email body or snippet should go through
 * these helpers rather than rendering `msg.body` directly.
 */

// ── Detection ────────────────────────────────────────────────────────────

/** Heuristic: does this string look like raw HTML rather than plaintext? */
export function isLikelyHtml(value: string): boolean {
  if (!value) return false;
  const sample = value.slice(0, 400).trim();
  if (/^<!doctype html/i.test(sample)) return true;
  if (/<html[\s>]/i.test(sample)) return true;
  // Multiple real tags close together is a strong signal even without <html>
  const tagMatches = value.slice(0, 2000).match(/<\/?[a-z][a-z0-9]*[^>]*>/gi);
  return !!tagMatches && tagMatches.length >= 4;
}

// ── Plain text extraction (for list snippets, search, etc.) ────────────────

/** Strip an HTML string down to its visible text content. Browser-only. */
export function htmlToPlainText(html: string): string {
  if (typeof window === "undefined" || !html) return html ?? "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, head").forEach((el) => el.remove());
    return (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

/**
 * Produce a single-line, human-readable snippet from a raw email body,
 * regardless of whether that body is plaintext, HTML, or HTML-flattened
 * marketing-email plaintext.
 */
export function getEmailSnippet(rawBody: string | undefined | null, maxLen = 140): string {
  if (!rawBody) return "No content";
  let text = rawBody;

  if (isLikelyHtml(text)) {
    text = htmlToPlainText(text);
  }

  text = text
    .replace(/\r\n/g, "\n")
    .replace(/-{3,}/g, " ") // decorative separator runs
    .replace(/\[image:[^\]]*\]/gi, "")
    .replace(/https?:\/\/\S+/g, "") // drop raw tracking links from preview text
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "No content";
  return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text;
}

// ── Dates ────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** Gmail-style relative date for list rows: "3:45 PM" / "Mon" / "Jun 5". */
export function formatEmailListDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) {
    return d.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString("en-KE", { weekday: "short" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

/** Full date+time for message headers, e.g. "Fri, Jun 5, 2026, 3:45 PM". */
export function formatEmailFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

// ── Misc formatting ──────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortenUrlForDisplay(url: string, maxLen = 42): string {
  try {
    const u = new URL(url);
    let display = u.hostname.replace(/^www\./, "");
    if (u.pathname && u.pathname !== "/") {
      const path = u.pathname + (u.search ? "?…" : "");
      display += path.length > 22 ? `${path.slice(0, 22)}…` : path;
    } else if (u.search) {
      display += "/?…";
    }
    return display.length > maxLen ? `${display.slice(0, maxLen)}…` : display;
  } catch {
    return url.length > maxLen ? `${url.slice(0, maxLen)}…` : url;
  }
}

/** Escape plain text and turn bare URLs into shortened, clickable links. */
function linkifyAndEscape(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const parts = text.split(urlRegex);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) {
        const href = part.replace(/&/g, "&amp;").replace(/"/g, "%22");
        const display = shortenUrlForDisplay(part);
        return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(display)}</a>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

const QUOTE_HEADER_RE = /(^On .{0,120}wrote:\s*$)|(^-{2,}\s*Original Message\s*-{2,}$)|(^From:\s*.+$)/im;

/**
 * Convert a raw plaintext email body into safe, readable HTML:
 * - collapses decorative dash separators into subtle dividers
 * - turns paragraphs into <p>, single newlines into <br>
 * - shortens + linkifies bare URLs instead of printing them raw
 * - splits off trailing quoted reply history so it can be collapsed in the UI
 */
export function plaintextToEmailHtml(raw: string): { mainHtml: string; quotedHtml: string | null } {
  const normalized = (raw || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return { mainHtml: "<p><em>No content</em></p>", quotedHtml: null };

  const headerMatch = normalized.match(QUOTE_HEADER_RE);
  const splitIndex = headerMatch?.index;
  const mainText = splitIndex !== undefined ? normalized.slice(0, splitIndex).trim() : normalized;
  const quotedText = splitIndex !== undefined ? normalized.slice(splitIndex).trim() : "";

  const render = (text: string) => {
    // Decorative separators (3+ dashes, possibly spaced) -> <hr>
    const withDividers = text.replace(/(^|\n)\s*-{3,}\s*(\n|$)/g, "$1\u0000HR\u0000$2");
    const blocks = withDividers.split(/\n{2,}/);
    return blocks
      .map((block) => {
        if (block.trim() === "\u0000HR\u0000") return '<hr class="email-divider" />';
        const withLinks = linkifyAndEscape(block.trim()).replace(/\n/g, "<br />");
        return `<p>${withLinks}</p>`;
      })
      .join("");
  };

  return {
    mainHtml: render(mainText),
    quotedHtml: quotedText ? render(quotedText) : null,
  };
}

// ── HTML sanitization (defense-in-depth on top of iframe sandboxing) ───────

export interface SanitizeResult {
  html: string;
  blockedImageCount: number;
}

/**
 * Clean an HTML email body for safe display:
 * - strips <script>, event handler attributes, javascript: URLs
 * - forces links to open in a new tab
 * - optionally strips remote image sources (privacy: blocks tracking pixels)
 * This is defense-in-depth — the iframe it's rendered in is also sandboxed
 * with scripts disabled, so no script in the source can execute regardless.
 */
export function sanitizeEmailHtml(html: string, allowImages: boolean): SanitizeResult {
  if (typeof window === "undefined") return { html, blockedImageCount: 0 };

  let blockedImageCount = 0;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    doc.querySelectorAll("script, meta[http-equiv='refresh'], base").forEach((el) => el.remove());

    doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
        if ((attr.name === "href" || attr.name === "src") && /^\s*javascript:/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    doc.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer nofollow");
    });

    doc.querySelectorAll("img").forEach((img) => {
      if (!allowImages) {
        const src = img.getAttribute("src");
        if (src) {
          img.setAttribute("data-original-src", src);
          img.removeAttribute("src");
          img.style.background = "#f1f5f9";
          img.style.minHeight = "1.25em";
          img.style.minWidth = "1.25em";
          blockedImageCount += 1;
        }
      }
    });

    return { html: doc.body.innerHTML, blockedImageCount };
  } catch {
    return { html, blockedImageCount: 0 };
  }
}

/** Wrap sanitized inner HTML in a minimal standalone document for an iframe. */
export function buildEmailIframeDoc(innerHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    font-size: 13.5px;
    line-height: 1.6;
    color: #374151;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    padding: 2px 2px 4px;
  }
  p { margin: 0 0 0.85em; }
  a { color: #004E98; }
  img, table { max-width: 100%; height: auto; }
  .email-divider { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
  blockquote { margin: 0.5em 0; padding-left: 0.85em; border-left: 2px solid #e5e7eb; color: #6b7280; }
</style>
</head><body>${innerHtml}</body></html>`;
}
