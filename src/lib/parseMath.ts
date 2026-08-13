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
 */

export type MathSegment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "block"; value: string };

const MATH_PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

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
