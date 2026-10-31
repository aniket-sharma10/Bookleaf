import "server-only";

// Data minimisation for everything sent to Gemini (architecture §6.6). The
// unpaid tier's terms let Google read and reuse prompts, so author-typed text
// is scrubbed of contact details and long account-like numbers, and the
// author's own name is replaced, before it leaves the server.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// A run of digits with common separators (spaces, dots, dashes, brackets),
// optionally starting with "+": candidates for phone or account numbers.
const DIGIT_RUN = /\+?\(?\d[\d ().-]{7,}\d/g;

function countDigits(text: string): number {
  return text.replace(/\D/g, "").length;
}

/** ISBNs are kept: they're book identifiers that support needs, not PII. */
function looksLikeIsbn(run: string, before: string): boolean {
  return /isbn[\s:#-]*$/i.test(before) || /^97[89][- ]\d/.test(run);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces emails with [email], phone-like numbers (10–13 digits, or any
 * "+" number) with [phone], other runs of 9+ digits (e.g. bank accounts)
 * with [number], and the author's name (full name, then each part of 3+
 * letters) with [AUTHOR]. Shorter numbers (amounts, copies, dates) and ISBNs
 * are kept, because answers depend on them.
 */
export function redact(text: string, authorName?: string): string {
  let result = text.replace(EMAIL, "[email]");

  result = result.replace(DIGIT_RUN, (run, offset: number) => {
    const digits = countDigits(run);
    if (digits < 9) return run;
    if (looksLikeIsbn(run, result.slice(Math.max(0, offset - 8), offset))) {
      return run;
    }
    return run.startsWith("+") || (digits >= 10 && digits <= 13)
      ? "[phone]"
      : "[number]";
  });

  if (authorName) {
    const parts = authorName.trim().split(/\s+/);
    const names = [parts.join(" "), ...parts.filter((p) => p.length >= 3)];
    for (const name of names) {
      result = result.replace(
        new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"),
        "[AUTHOR]",
      );
    }
  }
  return result;
}

/** Shortens text to `max` characters, marking the cut. */
export function clip(text: string, max: number): string {
  return text.length <= max
    ? text
    : `${text.slice(0, max).trimEnd()} …[truncated]`;
}

/**
 * Untrusted text is placed inside <tag>…</tag> blocks in prompts. Removing
 * any of our delimiter tags from the text stops it closing a block early and
 * posing as instructions.
 */
export function stripDelimiters(text: string, tags: string[]): string {
  const pattern = new RegExp(`</?\\s*(${tags.join("|")})\\s*>`, "gi");
  return text.replace(pattern, "");
}
