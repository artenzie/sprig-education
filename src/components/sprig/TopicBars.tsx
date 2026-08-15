/**
 * A bar per topic, each bar showing a 0-100 percentage.
 *
 * Lifted out of Progress.tsx, where it started as "% of this student's
 * subtopics finished, one bar per topic they've started" — the shape is
 * identical for "% of the class that has finished this topic, one bar per
 * topic with content", so rather than fork a second copy for the teacher
 * dashboard, the percentage is computed by the caller and this component
 * just draws bars.
 *
 * ONE REAL DIFFERENCE FROM THE ORIGINAL. Progress.tsx only ever passed
 * "topics this one student has started" — realistically 1-5 bars. The class
 * chart passes every topic with content ACROSS EVERY TIER (content now
 * exists in Tiers 2-3 too, not just Tier 1 — see the seeded migrations),
 * which can be 15+. The original version had a fixed-width SVG that divided
 * that width by item count, so past ~6 items the bars and their two-line
 * labels started overlapping into an unreadable mess. Bar width is now
 * fixed instead, and the SVG's own width grows with the item count; the
 * wrapping div scrolls horizontally rather than squeezing everything into a
 * box that was never sized for it. For the ≤5-item student case this looks
 * essentially identical to before.
 */

export type TopicBarItem = { id: string; title: string; percent: number };

const BAR_WIDTH = 76;
const GAP = 32;
const PAD_L = 12;
const PAD_R = 12;
const PAD_T = 20;
const PAD_B = 64;
const HEIGHT = 340;

export function TopicBars({
  items,
  ariaLabel = "Completion by topic",
}: {
  items: TopicBarItem[];
  ariaLabel?: string;
}) {
  const innerW = items.length * BAR_WIDTH + Math.max(items.length - 1, 0) * GAP;
  const innerH = HEIGHT - PAD_T - PAD_B;
  const W = PAD_L + PAD_R + innerW;
  const padL = PAD_L;
  const padT = PAD_T;
  const barW = BAR_WIDTH;
  const gap = GAP;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={W} height={HEIGHT} viewBox={`0 0 ${W} ${HEIGHT}`} className="block" role="img" aria-label={ariaLabel}>
        {/* baseline */}
        <line
          x1={padL}
          x2={W - PAD_R}
          y1={padT + innerH}
          y2={padT + innerH}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {items.map((item, i) => {
          const percent = item.percent;
          const x = padL + i * (barW + gap);
          const h = Math.max((percent / 100) * innerH, 2);
          const y = padT + innerH - h;
          return (
            <g key={item.id}>
              <path
                d={barPath(x, y, barW, h)}
                fill="var(--forest)"
                opacity={0.9}
              />
              <text
                x={x + barW / 2}
                y={y - 8}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-display)", fontSize: 13, fill: "var(--forest)" }}
              >
                {percent}%
              </text>
              {/* label */}
              <text
                x={x + barW / 2}
                y={padT + innerH + 20}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontFamily: "var(--font-sans)", fontSize: 10.5 }}
              >
                {shortLabel(item.title).line1}
              </text>
              <text
                x={x + barW / 2}
                y={padT + innerH + 34}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontFamily: "var(--font-sans)", fontSize: 10.5 }}
              >
                {shortLabel(item.title).line2}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * A bar with a rounded cap on top and a flat foot on the baseline.
 *
 * This used to be a <rect> with `rx={barW/2} ry={barW/2}`, which looked right
 * for tall bars and silently turned short ones into ellipses. The reason is a
 * rule in the SVG spec rather than anything wrong with those numbers: a corner
 * radius is clamped to half the side it sits on. `rx` was 38 against a 76-wide
 * bar, so it stayed 38 — but `ry` was clamped to `height / 2` the moment the
 * bar was shorter than 76px. A rectangle whose radii are exactly half its width
 * AND half its height is, geometrically, an ellipse.
 *
 * With innerH at 256px that made the threshold `76 / 256`, so every topic under
 * roughly 30% completion rendered as an oval blob — most topics, for most
 * students, on both the student Progress page and the teacher class chart.
 *
 * Clamping `ry` by hand does NOT fix it: `Math.min(barW/2, h/2)` is precisely
 * what the renderer was already doing. Keeping a full-width cap while refusing
 * to fully round the bottom means leaving the rounded-rect shape family
 * altogether, hence a path.
 *
 * The cap radius is `min(barW/2, h)` so a bar taller than half its width gets a
 * clean semicircular top, and a very short one degrades to a small nub instead
 * of a lens. The foot is always square, which also sits better against the
 * baseline than the old floating capsule did.
 */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h}`,
    "Z",
  ].join(" ");
}

// Longer titles (e.g. "Where Money Really Comes From") can still produce a
// line wider than one column's share of the chart even after splitting in
// two — truncating with an ellipsis, rather than just splitting on words,
// is what actually guarantees adjacent labels never bleed into each other.
const MAX_LINE_CHARS = 14;

function shortLabel(label: string): { line1: string; line2: string } {
  if (label.length <= MAX_LINE_CHARS) return { line1: label, line2: "" };
  const words = label.split(" ");
  if (words.length === 1) return { line1: truncate(label), line2: "" };
  const mid = Math.ceil(words.length / 2);
  return {
    line1: truncate(words.slice(0, mid).join(" ")),
    line2: truncate(words.slice(mid).join(" ")),
  };
}

function truncate(text: string, max = MAX_LINE_CHARS): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
