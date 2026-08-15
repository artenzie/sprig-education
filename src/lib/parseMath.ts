/**
 * Splits a slide body into plain-text and math runs so `text` slides can
 * carry a formula inside a sentence instead of needing a dedicated slide.
 * `$$...$$` (block) is matched before `$...$` (inline) so a display formula
 * never gets swallowed as two inline runs. A body with no `$` in it comes
 * back as a single text segment — identical to rendering the raw string.
 *
 * Currency in this project's content is always written `£`, never `$digit`
 * (checked against every seed migration), so `$` is unambiguous as a math
 * delimiter here.
 *
 * WHY INLINE MATH MAY CROSS ONE NEWLINE
 *
 * The inline pattern used to be `\$([^$\n]+?)\$` — no newline allowed at all.
 * That is fine for every formula currently in the content, all of which sit on
 * a single line, but it fails silently rather than loudly: an author who wraps
 * a long formula across two lines gets a literal `$` rendered on the page, with
 * no error anywhere to explain it.
 *
 * So one continuation line is now permitted. The bound matters, and is doing
 * real work in three ways:
 *
 *   - Same-line formulas are matched exactly as before. `[^$\n]` cannot cross a
 *     newline, so the optional continuation only engages when there is no
 *     closing `$` left on the first line. No existing match changes.
 *   - A stray, unpaired `$` in prose can swallow at most two lines before it
 *     runs out, instead of everything up to the next `$` however far away.
 *   - A blank line ends it outright: the continuation needs `\n` followed by at
 *     least one non-newline character, so math can never span a paragraph
 *     break. That is the natural boundary anyway.
 */

export type MathSegment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "block"; value: string };

const MATH_PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?(?:\n[^$\n]+?)?)\$/g;

export function parseMathSegments(body: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(MATH_PATTERN)) {
    const [full, blockValue, inlineValue] = match;
    const index = match.index;

    if (index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, index) });
    }
    segments.push(
      blockValue !== undefined
        ? { type: "block", value: blockValue.trim() }
        : { type: "inline", value: inlineValue.trim() },
    );
    lastIndex = index + full.length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: body }];
}
