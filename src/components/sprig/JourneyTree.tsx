import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Journey, TopicStatus } from "@/lib/journey";

// -----------------------------------------------------------------------------
// The journey tree
// -----------------------------------------------------------------------------
// A branching curriculum tree: a tapered trunk for Tier I, forking into three
// limbs that each end in a canopy of foliage for Tiers II, III and IV.
//
// The three ideas worth understanding before reading on:
//
//   1. LIMBS ARE GENERATED, NOT DRAWN. A trunk or branch is described as a
//      chain of cubic Beziers -- a centreline, one line of coordinates. `Limb`
//      walks that centreline, and at each step steps sideways along the
//      perpendicular by a width that shrinks from base to tip, producing a
//      filled tapered shape. Changing a limb means moving four points, not
//      hand-editing both edges of a ribbon and hoping they stay parallel.
//
//   2. CANOPIES ARE GENERATED FROM THE LABELS. Each tier's foliage is a single
//      organic blob computed to CONTAIN that tier's node discs and label text
//      boxes (see `tierPoints` -> `organicBlob`). The labels are not placed on
//      the foliage; the foliage is grown around the labels. Rename a topic to
//      something longer and the canopy swells to hold it.
//
//   3. POSITION IS DESIGN, STATUS IS DATA. Every coordinate in this file is
//      hand-tuned artwork and stays hardcoded. What is *not* hardcoded is
//      whether a node is complete, current or locked, whether a canopy is in
//      leaf, and how much fruit it carries -- all of that comes from the
//      student's real progress via the `journey` prop.
//
// `tier` + `topicOrder` are how a drawn node finds its real topic row. Every
// lesson node carries them, including the canopy ones that have no content
// authored yet -- so when Tiers 2-4 get seeded, the tree lights up on its own
// with no change to this file.
// -----------------------------------------------------------------------------

type Pt = [number, number];

type Node = {
  id: string;
  x: number;
  y: number;
  chapter: string;
  title: string;
  titleLines?: [string, string];
  tier: number;
  topicOrder: number;
  side: "left" | "right";
};

/** A milestone: the numeral disc that stands for a whole tier. */
type Milestone = {
  id: string;
  x: number;
  y: number;
  numeral: string;
  label: string;
  tier: number;
};

// --- Scale ------------------------------------------------------------------
// The viewBox is wider than it is tall, because three canopies sit side by
// side. Rendered into the dashboard's ~760px column the whole drawing scales by
// about 0.68, which is why the type sizes below look large: 16.5 user units
// lands at roughly 11px on screen.

// THE LEFT EDGE IS MEASURED, NOT GUESSED. The Application canopy is grown
// around its widest labels ("Buy Now, Pay Later", "Scams & Financial Safety")
// and its contour, plus the edge stroke, reaches x = -160. The viewBox began
// at -150, so ten units of the crown were being cut off by the SVG's own
// coordinate window — not by any CSS container, which is where you would look
// first and find every ancestor set to `overflow: visible`.
//
// -182 gives that contour ten units of air, and the width keeps the same
// margin past the Mastery crown on the right. A wider viewBox renders the tree
// very slightly SMALLER in the same column, which is the safe direction: the
// fix for clipping should never be to let the artwork grow into the space it
// was overflowing.
//
// THESE TWO NUMBERS ARE DOWNSTREAM OF LABEL_GAP AND LINE. The canopies are
// grown around the node label boxes, so widening the gap or the leading makes
// every crown bigger and pushes the outermost contour further out — the first
// attempt at this fix used -168/1184, which was correct until the spacing
// change below made the artwork 12 units wider than it had been when measured.
// If you touch the spacing, re-measure the union bbox and come back here.
const VB_X = -182;
const VB_Y = -30;
const VB_W = 1210;
const VB_H = 1075;
const VIEW_BOX = `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`;

const TRUNK_X = 410;
const GROUND_Y = 978;
const FORK: Pt = [410, 568];

const DISC_R = 15;
const MILESTONE_R = 30;
const HUB_R = 32;

const TITLE_SIZE = 16.5;
const ROMAN_SIZE = 11.5;
/** Vertical distance between two wrapped title lines. */
const LINE = 23;
/**
 * Horizontal gap between a node's disc and the start of its label.
 *
 * 30 put the first glyph 15 units from the disc's edge, which at render scale
 * is about ten pixels — close enough that a two-line label read as attached to
 * the circle rather than beside it. 42 is a clear gap at every size.
 */
const LABEL_GAP = 42;
/**
 * Rough average glyph width at TITLE_SIZE, used only to estimate how much room
 * a label needs so the canopy can be grown around it. An estimate is fine here
 * -- it pads a decorative silhouette, it does not align anything. (Contrast the
 * tier headers below, where a guessed width was a visible bug and is now
 * measured.)
 */
const CHAR_W = 8.2;

// --- Palette ----------------------------------------------------------------
// Every colour is derived from the Sprig tokens in index.css rather than
// hardcoded, so the tree follows the palette if the palette moves.
//
// THE CONTRAST CONSTRAINT, INVERTED. This block used to open by explaining
// that canopy labels are CREAM text on the foliage, so every canopy fill had
// to stay dark enough to carry them -- which is why a dormant canopy was a
// muted bark grey and a grown one a deep forest. That constraint was real, and
// it drove the whole tree toward the dark end of the palette. At 100%
// completion the result was three near-black masses filling the upper half of
// the screen: the exact moment a student should feel they have grown something
// is the moment the drawing looked heaviest.
//
// The constraint is now satisfied from the other side. Canopy labels are INK,
// the same near-black the rest of Sprig sets type in, so the foliage is free
// to be light -- the mint end of the palette this product is actually built
// from. A label on a canopy and a label on the cream page are now the same
// colour, which is also one fewer thing to get wrong.
//
// WHAT SEPARATES GROWN FROM DORMANT is therefore no longer lightness but
// CHROMA. A tier not yet reached is drab -- almost colourless, a grey-green
// ghost of a crown. A tier in leaf is the same lightness and properly
// saturated. "Not grown yet" reads as colourless rather than as dark, which is
// both a better metaphor and the only version that keeps every label legible
// in every state.
const TRUNK_FILL = "var(--forest)";
const LIMB_FILL = "var(--forest)";

/**
 * Canopy tones — one set per tier, and one PAIR per tier.
 *
 * The three canopies overlap by 150-200 units, so two crowns in the same state
 * sharing a colour read as a single mass. Each tier is separated from its
 * neighbours on hue, and grown is separated from dormant on chroma:
 *
 *   Application  hue ~145  (warm, green-leaning mint)
 *   Mathematics  hue ~168  (the --mint token's own hue, the brand centre)
 *   Mastery      hue ~195  (cool, teal-leaning mint)
 *
 * All six fills sit between 0.85 and 0.91 lightness. Against ink at 0.26 that
 * is an enormous contrast margin, so the labels are safe in every combination
 * and there is no longer a cap on how light the foliage may go -- which is
 * what makes the celebratory end of the scale reachable at all.
 */
type CanopyTone = { fill: string; shade: string };

/** Mix helper, kept as a string builder so the tokens stay readable above. */
const mix = (a: string, pct: number, b: string) =>
  `color-mix(in oklab, ${a} ${pct}%, ${b})`;

// Written as oklch rather than as mixes of existing tokens, deliberately. The
// six differ from each other by small, deliberate steps in hue and chroma at a
// held lightness, and expressing that as chains of color-mix() would hide the
// one thing a reader needs to see -- that they are a family, evenly spaced.
const CANOPY_TONES: Record<number, { grown: CanopyTone; dormant: CanopyTone }> = {
  // Application — warm mint. The first branch a student meets.
  2: {
    grown: { fill: "oklch(0.895 0.058 145)", shade: "oklch(0.845 0.062 148)" },
    dormant: { fill: "oklch(0.905 0.012 145)", shade: "oklch(0.862 0.014 148)" },
  },
  // Mathematics — the --mint token's own hue, the middle of the family.
  3: {
    grown: { fill: "oklch(0.878 0.062 168)", shade: "oklch(0.828 0.066 170)" },
    dormant: { fill: "oklch(0.892 0.011 168)", shade: "oklch(0.848 0.013 170)" },
  },
  // Mastery — cool mint, furthest from the trunk in both senses. Hue 186 and
  // not 195: at 195 the fill crossed out of green entirely and read as a pale
  // sky blue sitting next to two greens, which looked like a different product
  // rather than the third crown of the same tree. 186 is still clearly the
  // coolest of the three without leaving the family.
  4: {
    grown: { fill: "oklch(0.858 0.050 186)", shade: "oklch(0.808 0.054 188)" },
    dormant: { fill: "oklch(0.875 0.010 186)", shade: "oklch(0.832 0.012 188)" },
  },
};

const toneFor = (tier: number, grown: boolean): CanopyTone =>
  (CANOPY_TONES[tier] ?? CANOPY_TONES[3])[grown ? "grown" : "dormant"];

/**
 * The edge drawn around each canopy, separating neighbouring crowns.
 *
 * TWO CHANGES FROM THE ORIGINAL, and the colour one is a bug fix rather than
 * taste. This was a 5-wide stroke in `var(--background)` — cream, the page
 * colour — on the reasoning that a background-coloured outline separates two
 * overlapping shapes without inventing a border colour. It does, but it also
 * paints a 5-unit cream band THROUGH whatever is underneath, and the canopies
 * are painted in one order while all fifteen labels are painted afterwards on
 * top. So a label belonging to the canopy underneath could land on the cream
 * band of the canopy above it — cream text on a cream stroke, invisible. That
 * is the failure the labels on the Mastery/Mathematics seam were hitting.
 *
 * A dark edge cannot do that. Whatever crosses it, cream text stays legible,
 * because the whole point of the canopy palette is that cream reads on it.
 * It also survives the paint order changing, which it does: canopies are
 * sorted so grown ones draw last, so WHICH canopy is on top depends on the
 * student's progress rather than on anything in this file.
 *
 * Widened from 5 to 7 at the same time — at 5 the seam was about 3px on
 * screen, which hinted at a boundary without reading as two separate crowns.
 */
// The edge is now FOREST, which does two jobs at once. It separates
// neighbouring crowns against the new light fills, and it is the same colour
// as the trunk, the limbs and the lit lesson path -- so every structural line
// in the drawing is one colour and every filled area is another. The old dark
// ink edge was a third colour doing neither job.
const CANOPY_EDGE = "var(--forest)";
const CANOPY_EDGE_W = 5;

/**
 * Which canopy paints over which, bottom to top. Deliberately a constant and
 * not a function of progress — see the long note at the draw site.
 *
 * The order is chosen so that the labels which end up underneath are the ones
 * with the least to lose: Mathematics sits on top because it is the middle
 * crown and overlaps both neighbours, so burying it would cost twice.
 */
const CANOPY_PAINT_ORDER = [4, 2, 3];

// Canopy labels and cream-page labels are now THE SAME two colours. A label
// used to invert depending on what it sat on -- cream on foliage, ink on paper
// -- which is what forced the foliage to stay dark. With light canopies both
// surfaces take ink, so these four constants collapse to two in practice and
// are kept apart only because the roman numeral wants a little less weight on
// foliage than it does on paper.
const ON_CANOPY_TEXT = "var(--ink)";
const ON_CANOPY_ROMAN = "color-mix(in oklab, var(--forest) 80%, black)";
const ON_CREAM_TEXT = "var(--ink)";
const ON_CREAM_ROMAN = "var(--muted-foreground)";

const HEADING = "#2C4A38";
const FRUIT_RED = "#B5482F";
const FRUIT_ORANGE = "var(--terracotta)";

// --- Nodes ------------------------------------------------------------------

const TRUNK_NODES: Node[] = [
  { id: "t1", x: TRUNK_X, y: 908, chapter: "I.I",   title: "The Psychology of Spending",    tier: 1, topicOrder: 1, side: "right" },
  { id: "t2", x: TRUNK_X, y: 838, chapter: "I.II",  title: "Where Money Really Comes From", tier: 1, topicOrder: 2, side: "left"  },
  { id: "t3", x: TRUNK_X, y: 770, chapter: "I.III", title: "Making Money Decisions With What You Have", titleLines: ["Making Money Decisions", "With What You Have"], tier: 1, topicOrder: 3, side: "right" },
  { id: "t4", x: TRUNK_X, y: 701, chapter: "I.IV",  title: "How Banks and Money Actually Work", titleLines: ["How Banks and Money", "Actually Work"], tier: 1, topicOrder: 4, side: "left" },
  { id: "t5", x: TRUNK_X, y: 632, chapter: "I.V",   title: "Setting a Goal That Actually Matters to You", titleLines: ["Setting a Goal That", "Actually Matters to You"], tier: 1, topicOrder: 5, side: "right" },
];

// l1 and l2 moved left and down (318,549 -> 292,568 and 240,489 -> 206,492).
// These are the two nodes nearest the fork, and their labels reach right into
// the lower-left lobe of the Mathematics canopy: measured against a real
// account, 48% of "Budgeting Basics" and 18% of "How Pricing Tricks You" were
// sitting on Mathematics foliage rather than their own. Dropping l1 below the
// Mathematics canopy's clipped bottom edge and pulling l2 clear of its left
// edge fixes both without disturbing the branch's shape.
const APPLICATION_NODES: Node[] = [
  { id: "l1", x: 292, y: 568, chapter: "II.I",   title: "Budgeting Basics",       tier: 2, topicOrder: 1, side: "left" },
  { id: "l2", x: 206, y: 492, chapter: "II.II",  title: "How Pricing Tricks You", tier: 2, topicOrder: 2, side: "left" },
  { id: "l3", x: 180, y: 408, chapter: "II.III", title: "Subscriptions & Recurring Costs", titleLines: ["Subscriptions &", "Recurring Costs"], tier: 2, topicOrder: 3, side: "left" },
  { id: "l4", x: 148, y: 316, chapter: "II.IV",  title: "Buy Now, Pay Later",     tier: 2, topicOrder: 4, side: "left" },
  { id: "l5", x: 126, y: 218, chapter: "II.V",   title: "Scams & Financial Safety", titleLines: ["Scams &", "Financial Safety"], tier: 2, topicOrder: 5, side: "left" },
];

const MATHEMATICS_NODES: Node[] = [
  { id: "m1", x: 409, y: 514, chapter: "III.I",   title: "Percentages in Real Life", titleLines: ["Percentages in", "Real Life"], tier: 3, topicOrder: 1, side: "left" },
  { id: "m2", x: 413, y: 435, chapter: "III.II",  title: "Simple Interest",          tier: 3, topicOrder: 2, side: "right" },
  { id: "m3", x: 415, y: 355, chapter: "III.III", title: "Compound Interest Intuitively", titleLines: ["Compound Interest", "Intuitively"], tier: 3, topicOrder: 3, side: "left" },
  { id: "m4", x: 414, y: 278, chapter: "III.IV",  title: "Inflation Basics",         tier: 3, topicOrder: 4, side: "right" },
  { id: "m5", x: 413, y: 198, chapter: "III.V",   title: "Why Some Choices Are Riskier", titleLines: ["Why Some Choices", "Are Riskier"], tier: 3, topicOrder: 5, side: "left" },
];

// r1 raised from y=558 to y=545. It is the lowest Mastery node, so ITS box is
// what sets the floor on how far that canopy may be clipped (organicBlob never
// trims below the support distance of the content). At 558 the crown had to
// hang to y=577, and the outward-only wobble carried it to about 619 — right
// over the trunk's "Setting a Goal That Actually Matters to You", which is dark
// ink meant for cream paper and had 28% of its area on near-black foliage.
//
// 13 units is the whole of the adjustment, and the size is not arbitrary in
// either direction. Less and the canopy still reaches the trunk label; more and
// r1's own two-line label starts colliding with r2's above it — which is what
// happened at y=524, where "Budget Calculator (Python)" printed straight
// through "The Real Compound Interest Formula". The node is wedged between two
// constraints and this is the gap between them.
const MASTERY_NODES: Node[] = [
  { id: "r1", x: 508, y: 545, chapter: "IV.I",   title: "Budget Calculator (Python)", titleLines: ["Budget Calculator", "(Python)"], tier: 4, topicOrder: 1, side: "right" },
  { id: "r2", x: 588, y: 484, chapter: "IV.II",  title: "The Real Compound Interest Formula", titleLines: ["The Real Compound", "Interest Formula"], tier: 4, topicOrder: 2, side: "right" },
  { id: "r3", x: 632, y: 424, chapter: "IV.III", title: "Present & Future Value",     tier: 4, topicOrder: 3, side: "right" },
  { id: "r4", x: 662, y: 332, chapter: "IV.IV",  title: "Behavioural Finance",        tier: 4, topicOrder: 4, side: "right" },
  // r5 raised 238 -> 198. It is the TOP Mastery node, so its box sets how high
  // that canopy reaches. At 238 the crown topped out at y=188 while the IV
  // milestone disc bottoms at y=151 — leaving 37 units of bare limb standing on
  // cream between the two, which reads as a stray line poking out of the disc.
  // Application and Mathematics never had this because their crowns already
  // reach their discs (tops at 148 and 128).
  { id: "r5", x: 678, y: 198, chapter: "IV.V",   title: "Introduction to Crypto",     tier: 4, topicOrder: 5, side: "right" },
];

const MILESTONES: Milestone[] = [
  { id: "tm", x: TRUNK_X, y: 580, numeral: "I",   label: "Essentials",  tier: 1 },
  { id: "lm", x: 114,     y: 121, numeral: "II",  label: "Application", tier: 2 },
  { id: "mm", x: 415,     y: 121, numeral: "III", label: "Mathematics", tier: 3 },
  // y was 144 — 23 units below the other two, which is the whole of the
  // "the three section headings sit at different heights" complaint. The
  // headings themselves were never misaligned (all three share baseline y=62,
  // and getBBox agrees to the pixel); it was the numeral disc under Mastery
  // that hung low, and the eye reads the heading and its disc as one unit.
  // The Mastery limb's tip was raised to match, so the branch still runs into
  // the disc rather than stopping short of it.
  { id: "rm", x: 684,     y: 121, numeral: "IV",  label: "Mastery",     tier: 4 },
];

/** Fruit positions per tier, revealed one at a time as topics are completed. */
const FRUIT: Record<number, { x: number; y: number; r: number; tone: "red" | "orange" }[]> = {
  2: [
    { x: 286, y: 300, r: 8.2, tone: "red" },
    { x: 252, y: 427, r: 5.6, tone: "orange" },
    { x: 192, y: 236, r: 4.6, tone: "red" },
    { x: 214, y: 355, r: 6.4, tone: "orange" },
    { x: 158, y: 468, r: 5.2, tone: "red" },
  ],
  3: [
    { x: 463, y: 331, r: 7.4, tone: "orange" },
    { x: 455, y: 403, r: 5.0, tone: "red" },
    { x: 509, y: 247, r: 6.0, tone: "orange" },
    { x: 372, y: 292, r: 5.4, tone: "red" },
    { x: 486, y: 466, r: 4.8, tone: "orange" },
  ],
  4: [
    { x: 618, y: 382, r: 8.6, tone: "red" },
    { x: 693, y: 287, r: 5.4, tone: "orange" },
    { x: 565, y: 463, r: 4.6, tone: "red" },
    { x: 641, y: 195, r: 6.4, tone: "red" },
    { x: 712, y: 372, r: 5.2, tone: "orange" },
  ],
};

/** Leaves on the bare trunk, revealed as Tier I topics are completed. */
const TRUNK_LEAVES = [
  { x: 430, y: 800, r: -30 },
  { x: 388, y: 860, r: 25 },
  { x: 434, y: 730, r: -48 },
  { x: 386, y: 660, r: 30 },
  { x: 392, y: 604, r: -40 },
];

/** Leaves already on the ground. Pure scenery — no state attached. */
const FALLEN_LEAVES: { x: number; y: number; r: number; tone: "dark" | "light" }[] = [
  { x: 132, y: 578, r: 30,   tone: "dark" },
  { x: 214, y: 606, r: -55,  tone: "light" },
  { x: 334, y: 598, r: 140,  tone: "dark" },
  { x: 492, y: 572, r: -25,  tone: "light" },
  { x: 556, y: 640, r: 65,   tone: "dark" },
  { x: 708, y: 634, r: -70,  tone: "dark" },
  { x: 300, y: 962, r: 12,   tone: "dark" },
  { x: 512, y: 974, r: -160, tone: "light" },
  { x: 452, y: 996, r: 40,   tone: "dark" },
];

// --- Geometry helpers -------------------------------------------------------

function lines(node: Node): string[] {
  return node.titleLines ?? [node.title];
}

/** A point on a cubic Bezier at parameter t. */
function bez(p: Pt[], t: number): Pt {
  const [a, b, c, d] = p as [Pt, Pt, Pt, Pt];
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/**
 * A limb: a chain of cubic segments rendered as a FILLED shape whose width
 * tapers from w0 at the base to w1 at the tip.
 *
 * How it works: walk the centreline in small steps; at each step compute the
 * tangent by sampling either side, rotate it 90 degrees to get the normal, and
 * offset by half the current width in both directions. Collecting the left
 * offsets forwards and the right offsets backwards closes a single polygon.
 *
 * The `Math.pow(t, 0.75)` on the interpolation is what makes it look like wood:
 * a linear taper thins too evenly and reads as a cone. The exponent keeps the
 * limb thick for longer near the base and then narrows quickly, which is how
 * real branches carry their load.
 */
function Limb({ segs, w0, w1, fill }: { segs: Pt[][]; w0: number; w1: number; fill: string }) {
  const samples: { p: Pt; n: Pt }[] = [];
  const STEPS = 26;
  segs.forEach((seg, si) => {
    // Skip t=0 on every segment after the first: it is the same point as the
    // previous segment's t=1, and a duplicated sample makes the tangent NaN.
    for (let i = si === 0 ? 0 : 1; i <= STEPS; i++) {
      const t = i / STEPS;
      const p = bez(seg, t);
      const ahead = bez(seg, Math.min(1, t + 0.001));
      const behind = bez(seg, Math.max(0, t - 0.001));
      const dx = ahead[0] - behind[0];
      const dy = ahead[1] - behind[1];
      const len = Math.hypot(dx, dy) || 1;
      samples.push({ p, n: [-dy / len, dx / len] });
    }
  });

  const total = samples.length - 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  samples.forEach((s, i) => {
    const w = (w0 + (w1 - w0) * Math.pow(i / total, 0.75)) / 2;
    left.push([s.p[0] + s.n[0] * w, s.p[1] + s.n[1] * w]);
    right.push([s.p[0] - s.n[0] * w, s.p[1] - s.n[1] * w]);
  });

  const d =
    `M ${left[0][0].toFixed(1)} ${left[0][1].toFixed(1)} ` +
    left.slice(1).map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
    " " +
    right.reverse().map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
    " Z";

  return <path d={d} fill={fill} />;
}

/** Smooth OPEN curve through a list of points (Catmull-Rom converted to cubics). */
function smoothOpen(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Smooth CLOSED contour through a list of points. */
function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

/**
 * Every point a tier's foliage must cover: each node's disc plus the four
 * corners of its label's text box. This is the function that makes the canopy
 * fit the content instead of the content fit the canopy.
 */
type Rect = { x: number; y: number; w: number; h: number };

/** The box one node's disc-plus-label occupies. The unit both callers below share. */
function nodeBox(n: Node): Rect {
  const text = lines(n);
  const w = Math.max(...text.map((t) => t.length)) * CHAR_W + 12;
  const x0 = n.side === "left" ? n.x - LABEL_GAP - w : n.x - DISC_R - 4;
  const x1 = n.side === "right" ? n.x + LABEL_GAP + w : n.x + DISC_R + 4;
  const yTop = n.y - DISC_R - 12 - (text.length - 1) * LINE;
  const yBot = n.y + DISC_R + 4;
  return { x: x0, y: yTop, w: x1 - x0, h: yBot - yTop };
}

function tierPoints(nodes: Node[]): Pt[] {
  const pts: Pt[] = [];
  for (const n of nodes) {
    const b = nodeBox(n);
    pts.push([b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]);
  }
  return pts;
}

/**
 * One large organic silhouette that contains every given point.
 *
 * Built from the SUPPORT FUNCTION of the point set: for each of 42 directions
 * around a circle, find how far the furthest point projects in that direction.
 * That gives a convex hull in polar form, guaranteed to enclose everything.
 * Straight off it looks like a cut gem, so the radii are then smoothed with a
 * small circular kernel and multiplied by a few low-frequency sine waves --
 * enough irregularity that no two canopies share a silhouette, not so much that
 * the contour stops being a leaf mass.
 *
 * `yMax` clips the bottom: without it a canopy droops past the fork and
 * swallows the trunk.
 *
 * TWO RULES KEEP THE CONTOUR HONEST, and both exist because breaking them put
 * a cream label on the cream background where it was invisible:
 *
 *   - `outward` clamps the wobble to >= 1. The sine terms swing about +-12%,
 *     so on a downswing they pull the contour INSIDE the padded hull -- and
 *     a label near the edge ends up half off the foliage. Bulging only
 *     outward keeps every label covered and still reads as hand-drawn.
 *   - the `yMax` clip is floored at `h`, the unpadded support distance. The
 *     clip is there to trim the canopy's overhang, so it may eat the padding,
 *     but it must never cut into the content the canopy exists to sit behind.
 *
 * NOTE ON `outward` AND `yMax` TOGETHER: the clip is applied to the raw radius
 * before the wobble multiplies it, so an outward-only wobble can still push the
 * contour past `yMax` by up to about 12%. That is why the Mastery canopy needed
 * its yMax pulled well clear of the trunk label rather than just below it.
 */
function organicBlob(
  pts: Pt[],
  pad: number,
  seed: number,
  opts?: { scale?: number; shift?: Pt; yMax?: number; outward?: boolean },
): string {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  const N = 42;
  const raw: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let h = 0;
    for (const p of pts) h = Math.max(h, (p[0] - cx) * ux + (p[1] - cy) * uy);
    let r = h + pad;
    // Trim the overhang, but never below the support distance itself.
    if (opts?.yMax !== undefined && uy > 0.05) r = Math.max(h, Math.min(r, (opts.yMax - cy) / uy));
    raw.push(r);
  }

  const kernel = [1, 3, 5, 3, 1];
  const smoothed = raw.map((_, i) => {
    let sum = 0;
    let weight = 0;
    kernel.forEach((w, j) => {
      sum += w * raw[(i + j - 2 + N) % N];
      weight += w;
    });
    return sum / weight;
  });

  const scale = opts?.scale ?? 1;
  const [sx, sy] = opts?.shift ?? [0, 0];
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wobble =
      1 +
      0.055 * Math.sin(a * 2 + seed) +
      0.04 * Math.sin(a * 3 - seed * 1.7) +
      0.025 * Math.sin(a * 5 + seed * 0.6);
    const r = smoothed[i] * (opts?.outward ? Math.max(1, wobble) : wobble) * scale;
    out.push([cx + Math.cos(a) * r + sx, cy + Math.sin(a) * r * 0.98 + sy]);
  }
  return smoothClosed(out);
}

// --- Foliage, fruit, leaves --------------------------------------------------

function TierCanopy({
  nodes,
  seed,
  id,
  tier,
  yMax,
  dx = 0,
  pad = 22,
  grown,
}: {
  nodes: Node[];
  seed: number;
  id: string;
  /** Which tier this canopy belongs to — selects its tone from CANOPY_TONES. */
  tier: number;
  yMax: number;
  dx?: number;
  pad?: number;
  /** Has the student reached this tier? Drives the whole colour treatment. */
  grown: boolean;
}) {
  const tone = toneFor(tier, grown);
  const pts = tierPoints(nodes).map(([x, y]) => [x + dx, y] as Pt);
  const main = organicBlob(pts, pad, seed, { yMax, outward: true });
  const shade = organicBlob(pts, pad, seed + 4.1, { scale: 0.9, shift: [22, 36], yMax });
  const light = organicBlob(pts, pad, seed + 9.3, { scale: 0.4, shift: [-50, -68], yMax });

  return (
    <g>
      <clipPath id={`sprig-canopy-${id}`}>
        <path d={main} />
      </clipPath>
      <path d={main} fill={tone.fill} stroke={CANOPY_EDGE} strokeWidth={CANOPY_EDGE_W} />
      <g clipPath={`url(#sprig-canopy-${id})`}>
        <path d={shade} fill={tone.shade} opacity={0.5} />
        {/* The highlight lobe only appears once the tier is in leaf — a dormant
            canopy should look flat and unlit. */}
        {/* Cream, not mint. On the old dark foliage a mint lobe read as light
            falling on the crown; on light foliage it vanished. Cream is the
            page's own colour, so the lobe now reads as a gap in the leaves. */}
        {grown && <path d={light} fill="var(--cream)" opacity={0.32} />}
      </g>
    </g>
  );
}

/**
 * The lesson path threading through a canopy, drawn twice: a dim full-length
 * line for the whole tier, and a bright overlay covering the completed part.
 *
 * `pathLength={1}` renormalises the path so its total length is exactly 1
 * whatever its real geometry, which lets `strokeDasharray` be written as a
 * plain fraction. Without it we would have to measure the path in the DOM.
 */
function LessonPath({
  nodes,
  start,
  fraction,
}: {
  nodes: Node[];
  start: Pt;
  fraction: number;
}) {
  const d = smoothOpen([start, ...nodes.map((n) => [n.x, n.y] as Pt)]);
  return (
    // Forest, not mint. The lit portion of this path is the same colour as the
    // limbs it continues from and the ring around every node sitting on it —
    // one structural colour for the whole drawing. Mint was invisible against
    // the new light canopies anyway.
    //
    // Widened 6 -> 10 so a 30-wide node disc overhangs it less; see the note
    // on the trunk and limb widths below.
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="var(--forest)" strokeWidth="10" opacity={0.2} />
      {fraction > 0 && (
        <path
          d={d}
          stroke="var(--forest)"
          strokeWidth="10"
          opacity={0.95}
          pathLength={1}
          strokeDasharray={`${fraction} 1`}
        />
      )}
    </g>
  );
}

function Leaf({
  x,
  y,
  r,
  fill,
  scale = 1,
}: {
  x: number;
  y: number;
  r: number;
  fill: string;
  scale?: number;
}) {
  return (
    <path
      d="M0 0 C 5 -4, 12 -3, 14 2 C 9 6, 2 5, 0 0 Z"
      transform={`translate(${x} ${y}) rotate(${r}) scale(${scale})`}
      fill={fill}
    />
  );
}

function Fruit({
  x,
  y,
  r,
  tone,
  stem = mix("var(--forest)", 50, "black"),
}: {
  x: number;
  y: number;
  r: number;
  tone: "red" | "orange";
  /**
   * The little stalk's colour. Defaults to a mid forest shade, which is right
   * for the windfall fruit lying on the cream ground. Fruit sitting IN a
   * canopy passes that canopy's own shade instead — otherwise every stalk was
   * drawn in one tier's green regardless of which crown it hung in, which the
   * per-tier tones made obvious.
   */
  stem?: string;
}) {
  return (
    <g>
      <path
        d={`M ${x} ${y - r * 0.8} C ${x + r * 0.2} ${y - r * 1.7}, ${x + r * 0.9} ${y - r * 1.9}, ${x + r * 1.25} ${y - r * 2.1}`}
        fill="none"
        stroke={stem}
        strokeWidth={Math.max(0.7, r * 0.22)}
        strokeLinecap="round"
      />
      {/* Rotated by a function of its own x, so each berry sits at a slightly
          different angle without needing a random seed that changes per render. */}
      <ellipse
        cx={x}
        cy={y}
        rx={r}
        ry={r * 0.92}
        transform={`rotate(${(x % 7) * 3 - 10} ${x} ${y})`}
        fill={tone === "red" ? FRUIT_RED : FRUIT_ORANGE}
      />
    </g>
  );
}

// --- Tier headers ------------------------------------------------------------

/**
 * A tier name with a rule under it, drawn to the width of the actual glyphs.
 *
 * The rule used to be sized from a character count -- `label.length * k`. That
 * was wrong in both directions at once: too short overall, and wrong by a
 * DIFFERENT amount per label, because "Mastery" (7 characters) and
 * "Mathematics" (11) are not in a 7:11 width ratio in a proportional italic
 * serif. A rule that runs first-letter-to-last cannot be derived from a
 * character count.
 *
 * So measure it instead. getBBox() on the rendered <text> returns its tight
 * bounding box in viewBox units, which is exactly the span wanted, and stays
 * right if a label is renamed or the font changes.
 *
 * THE SUBTLETY IS THE FONT. Fraunces arrives over the network, and the first
 * paint happens in the fallback serif -- so a single measurement on mount
 * records the width of the WRONG typeface and leaves the rule mis-sized for the
 * life of the page. document.fonts.ready re-measures once the real font lands.
 * Until the first measurement completes the rule is not drawn at all, rather
 * than drawn at a wrong length and corrected a frame later.
 */
const HEADER_SIZE = 26;

function TierHeader({
  x,
  y,
  label,
  anchor,
}: {
  x: number;
  y: number;
  label: string;
  anchor: "middle" | "end";
}) {
  const textRef = useRef<SVGTextElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled || !textRef.current) return;
      setWidth(textRef.current.getBBox().width);
    };

    measure();
    // Optional-chained: document.fonts is absent in jsdom and older Safari,
    // where the mount-time measurement is simply the final one.
    void document.fonts?.ready.then(measure);

    return () => {
      cancelled = true;
    };
  }, [label]);

  const x1 = width === null ? 0 : anchor === "end" ? x - width : x - width / 2;
  const x2 = width === null ? 0 : anchor === "end" ? x : x + width / 2;

  return (
    <g>
      <text
        ref={textRef}
        x={x}
        y={y}
        textAnchor={anchor}
        fill={HEADING}
        fontFamily="var(--font-display, 'Fraunces', serif)"
        fontStyle="italic"
        fontSize={HEADER_SIZE}
        fontWeight={400}
        letterSpacing="-0.3"
      >
        {label}
      </text>
      {width !== null && (
        <line x1={x1} x2={x2} y1={y + 9} y2={y + 9} stroke={HEADING} strokeWidth={1} opacity={0.6} />
      )}
    </g>
  );
}

// --- Interactive nodes -------------------------------------------------------

function CheckGlyph({ x, y, stroke }: { x: number; y: number; stroke: string }) {
  return (
    <path
      d={`M ${x - 6.3} ${y} l 4.5 4.8 l 8.1 -9`}
      fill="none"
      stroke={stroke}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/**
 * The padlock on a locked node.
 *
 * `OPTICAL_LIFT` is worth explaining, because the glyph was already centred
 * before it and measurement says so: the bounding box of the two shapes
 * centres on the node to within 0.15 units out of 12.7, which is under a tenth
 * of a pixel on screen. Geometrically there was nothing to fix.
 *
 * What is off is the BALANCE, not the box. The body is a filled-width rounded
 * rect 9.6 x 7.4 sitting entirely below the centre line, while the shackle
 * above it is a thin open arc. Weighting each shape by the length of stroke it
 * puts on the page — roughly 34 units for the body against 14 for the shackle —
 * the ink centres about 0.6 units BELOW the node's centre, so the lock reads as
 * sitting low in its disc even though a ruler says it is centred. Lifting the
 * whole glyph by that much brings the visual centre onto the geometric one.
 *
 * This is the standard reason icons carry hand-tuned offsets: the eye centres
 * mass, not bounding boxes.
 */
const OPTICAL_LIFT = 0.6;

function LockGlyph({ x, y, stroke }: { x: number; y: number; stroke: string }) {
  const cy = y - OPTICAL_LIFT;
  return (
    <g fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round">
      <path d={`M ${x - 2.9} ${cy - 1.2} v -2.4 a 2.9 2.9 0 0 1 5.8 0 v 2.4`} />
      <rect x={x - 4.8} y={cy - 1.2} width="9.6" height="7.4" rx="1.4" />
    </g>
  );
}

/**
 * One lesson node's ARTWORK: the disc, its Roman numeral and its title.
 *
 * The label is drawn in SVG rather than in HTML because it is part of the
 * picture -- the canopy is literally grown around the label's bounding box (see
 * `tierPoints`), and a label sitting on dark foliage has to be cream.
 *
 * Interaction is NOT here. It lives in a transparent HTML <button> laid over
 * this disc, for a reason worth writing down: an SVG <g role="button"
 * tabIndex={0}> is focusable and clickable, but it is not a button. Assistive
 * technology support for roles on SVG containers is patchy, and a pass with an
 * accessibility-tree reader over this component found zero controls where there
 * should have been twenty. A real <button> is exposed everywhere, gets Enter
 * and Space for free, and cannot be got wrong.
 */
function LessonNodeArt({ node, status }: { node: Node; status: TopicStatus }) {
  const onCanopy = node.tier > 1;
  const text = lines(node);
  const left = node.side === "left";
  const tx = left ? node.x - LABEL_GAP : node.x + LABEL_GAP;
  const anchor = left ? "end" : "start";
  const romanY = node.y - 7 - (text.length - 1) * LINE;

  // Disc treatment — NOW THE SAME ON BOTH SURFACES, which is the point.
  //
  // It used to invert: a cream disc on dark foliage, a dark disc on cream
  // paper. That was forced by the foliage being darker than the page, and it
  // meant a completed node looked like two different components depending on
  // which half of the drawing it sat in. Both surfaces are light now, so a
  // node is a forest disc with a cream glyph everywhere, and a locked one is
  // an open ring on whatever it is sitting on.
  //
  // The ring is `var(--forest)` — the same colour as the trunk, the limbs and
  // the lit lesson path. That was the mismatch: a mint ring on a forest branch
  // read as two unrelated systems overlapping.
  const discFill =
    status === "locked" ? "var(--background)" : "var(--forest)";
  const discStroke = status === "locked" ? "var(--forest)" : "none";
  const glyphStroke =
    status === "locked" ? "color-mix(in oklab, var(--forest) 70%, white)" : "var(--cream)";

  const titleFill = onCanopy ? ON_CANOPY_TEXT : ON_CREAM_TEXT;
  const romanFill = onCanopy ? ON_CANOPY_ROMAN : ON_CREAM_ROMAN;
  // A locked topic is drawn, not hidden — the student should see what is
  // ahead of them — but it recedes. One value now rather than two: both
  // surfaces are light and both labels are ink, so there is no longer a case
  // where fading a label pushes it toward the colour behind it.
  const dim = status === "locked" ? 0.72 : 1;

  return (
    <g>
      <g opacity={dim}>
        <circle
          cx={node.x}
          cy={node.y}
          r={DISC_R}
          fill={discFill}
          stroke={discStroke}
          strokeWidth={discStroke === "none" ? 0 : 1.4}
        />

        {status === "complete" && <CheckGlyph x={node.x} y={node.y} stroke={glyphStroke} />}
        {status === "current" && <circle cx={node.x} cy={node.y} r={5} fill={glyphStroke} />}
        {status === "locked" && <LockGlyph x={node.x} y={node.y} stroke={glyphStroke} />}

        <text
          x={tx}
          y={romanY}
          textAnchor={anchor}
          fill={romanFill}
          fontSize={ROMAN_SIZE}
          fontWeight={600}
          letterSpacing="1.9"
        >
          {node.chapter}
          {status === "current" && (
            <tspan fill="var(--terracotta)" dx="8">
              NOW
            </tspan>
          )}
        </text>

        {text.map((line, i) => (
          <text
            key={line}
            x={tx}
            y={node.y + 6 + (i - (text.length - 1)) * LINE}
            textAnchor={anchor}
            fill={titleFill}
            fontSize={TITLE_SIZE}
            fontWeight={status === "current" ? 600 : 400}
          >
            {line}
          </text>
        ))}
      </g>

      {/* The ring for the current topic sits OUTSIDE the dimming group and
          above the disc, so it stays at full strength. */}
      {status === "current" && (
        <circle
          cx={node.x}
          cy={node.y}
          r={DISC_R + 5}
          fill="none"
          stroke="var(--terracotta)"
          strokeWidth={2.2}
        />
      )}
    </g>
  );
}

/**
 * The transparent control sitting over a node's disc.
 *
 * Positioned as a percentage of the wrapper, which works because the wrapper is
 * given the viewBox's own aspect ratio and the SVG fills it exactly -- so
 * viewBox units and wrapper percentages describe the same grid at every screen
 * size. The button carries the accessible name and all the interaction; the
 * artwork underneath carries the appearance.
 */
function LessonNodeButton({
  node,
  status,
  onOpen,
}: {
  node: Node;
  status: TopicStatus;
  onOpen?: () => void;
}) {
  // A locked node still gets a button, disabled -- exactly as the old tree did.
  // Dropping it entirely would hide the locked half of the curriculum from
  // anyone reading the page through assistive technology, when the whole point
  // of drawing locked topics rather than hiding them is that the student can
  // see what is coming.
  return (
    <button
      type="button"
      disabled={!onOpen}
      aria-label={`${node.chapter} ${node.title}`}
      onClick={onOpen}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-forest/40 ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:outline-none ${
        onOpen ? "cursor-pointer hover:ring-2" : "cursor-default"
      }`}
      style={{
        left: `${((node.x - VB_X) / VB_W) * 100}%`,
        top: `${((node.y - VB_Y) / VB_H) * 100}%`,
        width: `${((DISC_R * 2 + 8) / VB_W) * 100}%`,
        aspectRatio: "1",
      }}
    >
      {/* The disc, the numeral and the title are all drawn in the SVG below.
          Nothing to render here — this is a hit target and an accessible name. */}
      <span className="sr-only">
        {status === "complete" ? "Completed" : status === "current" ? "In progress" : "Locked"}
      </span>
    </button>
  );
}

/** The numeral disc standing for a whole tier. */
function MilestoneDisc({
  milestone,
  complete,
  radius,
}: {
  milestone: Milestone;
  complete: boolean;
  radius: number;
}) {
  return (
    <g>
      <circle cx={milestone.x} cy={milestone.y} r={radius} fill={TRUNK_FILL} />
      {complete && (
        <circle
          cx={milestone.x}
          cy={milestone.y}
          r={radius - 5}
          fill="none"
          stroke="var(--mint)"
          strokeWidth={1.6}
          opacity={0.8}
        />
      )}
      <text
        x={milestone.x}
        y={milestone.y + 7}
        textAnchor="middle"
        fill="var(--cream)"
        fontFamily="var(--font-display, 'Fraunces', serif)"
        fontStyle="italic"
        fontSize={22}
      >
        {milestone.numeral}
      </text>
    </g>
  );
}

// --- Main --------------------------------------------------------------------

/**
 * The tree does not fetch anything itself.
 *
 * It used to run its own `topics` query purely to turn node ids into topic ids,
 * which meant the dashboard and the tree each hit the database for overlapping
 * data on the same screen. Now the dashboard loads the journey once via
 * useJourney() and passes it down. One query, one source of truth, and the tree
 * becomes a pure function of its props -- which is also what makes it re-render
 * correctly the moment a lesson is completed.
 */
export function JourneyTree({ journey }: { journey: Journey }) {
  const navigate = useNavigate();

  // tier+order -> the real topic, for both the link target and the status.
  const byPosition = new Map(journey.topics.map((t) => [`${t.tier}.${t.order}`, t]));

  const topicsInTier = (tier: number) => journey.topics.filter((t) => t.tier === tier);
  const completedInTier = (tier: number) =>
    topicsInTier(tier).filter((t) => t.status === "complete").length;

  /**
   * A tier is "in leaf" once the student has reached it at all -- one topic
   * complete, or one topic currently open. Reached, not finished: the branch
   * you are working on should look alive.
   */
  const grown = (tier: number) =>
    topicsInTier(tier).some((t) => t.status === "complete" || t.status === "current");

  /** A milestone completes only when every topic in its tier does. */
  const tierComplete = (tier: number) => {
    const topics = topicsInTier(tier);
    return topics.length > 0 && topics.every((t) => t.status === "complete");
  };

  /**
   * A node with no matching topic row isn't just unstarted, it's undrawable --
   * nothing to open. Locked is the honest state.
   */
  const resolve = (n: Node) => {
    const topic = byPosition.get(`${n.tier}.${n.topicOrder}`);
    return {
      status: topic?.status ?? "locked",
      onOpen:
        topic && topic.status !== "locked" ? () => navigate(`/topic/${topic.id}`) : undefined,
    } as { status: TopicStatus; onOpen?: () => void };
  };

  const ALL_NODES = [
    ...TRUNK_NODES,
    ...APPLICATION_NODES,
    ...MATHEMATICS_NODES,
    ...MASTERY_NODES,
  ];

  const renderNodeArt = (list: Node[]) =>
    list.map((n) => <LessonNodeArt key={n.id} node={n} status={resolve(n).status} />);

  // `dx` pushes a canopy sideways and `pad` inflates it. Application and
  // Mastery are pushed further out than they were (-14 -> -30, +18 +> +34) to
  // open a real gap either side of Mathematics: the three used to overlap
  // enough that four Mathematics labels lay partly on a NEIGHBOUR's foliage,
  // which is invisible while every canopy is one colour and glaring once they
  // are not.
  //
  // Mastery's `yMax` drops from 606 to 578. That clip sets how far the crown
  // droops, and at 606 it hung over the trunk's "Setting a Goal That Actually
  // Matters to You" — a label drawn in dark ink for cream paper, with 28% of
  // its area landing on near-black foliage. 578 clears it and still contains
  // Mastery's own lowest node box (node r1 bottoms out at y=577).
  const canopyTiers = [
    { tier: 2, nodes: APPLICATION_NODES, seed: 1.3, id: "app",  yMax: 598, dx: -30, pad: 22 },
    { tier: 3, nodes: MATHEMATICS_NODES, seed: 2.7, id: "math", yMax: 536, dx: 0,   pad: 20 },
    { tier: 4, nodes: MASTERY_NODES,     seed: 4.9, id: "mast", yMax: 566, dx: 34,  pad: 24 },
  ];

  return (
    // The wrapper is given the viewBox's own aspect ratio and the SVG is
    // stretched to fill it. That is what lets the button overlay below be
    // positioned in plain percentages of viewBox coordinates.
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      <svg
        viewBox={VIEW_BOX}
        className="absolute inset-0 h-full w-full"
        // Pure artwork: every readable thing in here is also announced by the
        // buttons in the overlay, so exposing it twice would only be noise.
        aria-hidden
      >
        {/* Ground line and roots */}
        <line x1="68" x2="752" y1={GROUND_Y} y2={GROUND_Y} stroke="var(--border)" strokeWidth="1" />
        <g stroke="var(--sage)" fill="none" strokeWidth="1.2" strokeLinecap="round">
          <path d={`M ${TRUNK_X} ${GROUND_Y} C 400 990, 380 995, 352 998`} />
          <path d={`M ${TRUNK_X} ${GROUND_Y} C 420 990, 442 995, 470 998`} />
          <path d={`M ${TRUNK_X} ${GROUND_Y} C 408 992, 407 1002, 407 1012`} />
          <path d={`M ${TRUNK_X} ${GROUND_Y} C 396 986, 372 988, 340 986`} />
          <path d={`M ${TRUNK_X} ${GROUND_Y} C 424 986, 448 988, 482 986`} />
        </g>

        {/* Trunk — thick at the base, tapering and gently curving upward.
            w1 went 16 -> 32: a node disc is 30 units across, so on a trunk
            tapering to 16 the upper nodes hung over both edges by seven units
            each. 32 contains them, and the base moved 36 -> 40 so it is still
            visibly a taper. The limbs got the same treatment (4 -> 13) for the
            same reason, alongside the lesson path going 6 -> 10. */}
        <Limb
          segs={[
            [[410, 986], [402, 900], [419, 782], [411, 692]],
            [[411, 692], [405, 652], [409, 620], [410, 588]],
          ]}
          w0={40}
          w1={32}
          fill={TRUNK_FILL}
        />

        {/* Three branches growing out of the fork into each canopy. Each one is
            a different length and takes a different route — the asymmetry is
            the point, a mirrored tree reads as a logo rather than a plant. */}
        <Limb
          segs={[
            [[408, 606], [392, 566], [330, 524], [266, 462]],
            [[266, 462], [210, 408], [158, 300], [118, 138]],
          ]}
          w0={20}
          w1={13}
          fill={LIMB_FILL}
        />
        <Limb
          segs={[[[411, 606], [414, 520], [410, 340], [415, 138]]]}
          w0={20}
          w1={13}
          fill={LIMB_FILL}
        />
        {/* Tip raised from y=162 to y=139 alongside the Mastery milestone disc,
            which moved from 144 to 121. The disc has r=30, so at the old pairing
            the tip sat inside it; leaving the tip behind would have left 20-odd
            units of branch poking out below a disc that had moved on. */}
        <Limb
          segs={[
            [[413, 606], [442, 570], [522, 542], [590, 470]],
            [[590, 470], [646, 400], [674, 270], [684, 139]],
          ]}
          w0={20}
          w1={13}
          fill={LIMB_FILL}
        />

        {/* Canopy foliage: one organic mass behind each tier.
            Neighbouring canopies overlap by 150-200 units, so draw order is
            visible — and it is now FIXED (Mastery, Application, Mathematics)
            rather than sorted by progress.

            It used to sort dormant-first so that the branch the student had
            reached came forward instead of being partly buried. That reads
            well and quietly broke label legibility, because whichever canopy
            lands on top also paints over its neighbours' labels. Measured on
            one account: with Mathematics on top, "Simple Interest" sat wholly
            on its own foliage; drop that same student back to no progress, the
            order flips to Mastery-on-top, and 68% of the same label is on
            Mastery instead. The label was fine or broken depending on how far
            through the course the reader happened to be, which is not a
            property anyone can design against or test once.

            A fixed order costs the "my branch comes forward" cue, and that is
            an acceptable price now the three tiers carry genuinely different
            tones: colour tells you which crown is which and whether it is in
            leaf, which is more information than z-order was ever giving. In
            exchange every student sees the same drawing, so the label
            positions below can be tuned once and stay tuned. */}
        {[...canopyTiers]
          .sort((a, b) => CANOPY_PAINT_ORDER.indexOf(a.tier) - CANOPY_PAINT_ORDER.indexOf(b.tier))
          .map((c) => (
            <TierCanopy
              key={c.id}
              nodes={c.nodes}
              seed={c.seed}
              id={c.id}
              tier={c.tier}
              yMax={c.yMax}
              dx={c.dx}
              pad={c.pad}
              grown={grown(c.tier)}
            />
          ))}

        {/* The lesson journey through each canopy, lit as far as it is walked */}
        {canopyTiers.map((c) => (
          <LessonPath
            key={c.id}
            nodes={c.nodes}
            start={FORK}
            fraction={completedInTier(c.tier) / c.nodes.length}
          />
        ))}

        {/* Fruit — one berry per completed topic in that tier. Fruit is the one
            thing on the tree that is purely earned: an untouched canopy carries
            none, and a finished one is heavy with them. */}
        {canopyTiers.map((c) =>
          FRUIT[c.tier].slice(0, completedInTier(c.tier)).map((f, i) => (
            <Fruit
              key={`${c.id}-${i}`}
              {...f}
              stem={toneFor(c.tier, grown(c.tier)).shade}
            />
          )),
        )}

        {/* Leaves on the bare trunk, likewise revealed as Tier I is worked through */}
        {TRUNK_LEAVES.slice(0, completedInTier(1)).map((l, i) => (
          <Leaf key={`trunk-leaf-${i}`} {...l} fill="var(--mint)" />
        ))}

        {/* Fallen leaves and windfall fruit — scenery, always present */}
        {FALLEN_LEAVES.map((l, i) => (
          <Leaf
            key={`fallen-${i}`}
            x={l.x}
            y={l.y}
            r={l.r}
            scale={0.62}
            fill={l.tone === "dark" ? "var(--forest)" : "var(--mint)"}
          />
        ))}
        <Fruit x={286} y={992} r={4.6} tone="red" />
        <Fruit x={556} y={986} r={4.2} tone="orange" />

        {/* Tier headers. The three canopy names share a baseline high above the
            drawing; "Essentials" is the only one set beside its subject rather
            than above it, because the trunk milestone sits mid-drawing. */}
        <TierHeader x={114} y={62} label="Application" anchor="middle" />
        <TierHeader x={415} y={62} label="Mathematics" anchor="middle" />
        <TierHeader x={684} y={62} label="Mastery" anchor="middle" />
        <TierHeader x={334} y={643} label="Essentials" anchor="end" />

        {/* Milestone discs */}
        {MILESTONES.filter((m) => m.tier > 1).map((m) => (
          <MilestoneDisc key={m.id} milestone={m} complete={tierComplete(m.tier)} radius={MILESTONE_R} />
        ))}
        <MilestoneDisc
          milestone={MILESTONES[0]}
          complete={tierComplete(1)}
          radius={HUB_R}
        />

        {/* Lesson discs and labels last, so no foliage paints over them */}
        {renderNodeArt(TRUNK_NODES)}
        {canopyTiers.map((c) => (
          <g key={`nodes-${c.id}`}>{renderNodeArt(c.nodes)}</g>
        ))}
      </svg>

      {/* Interaction overlay: one real button per node, over its disc. */}
      {ALL_NODES.map((n) => (
        <LessonNodeButton key={n.id} node={n} {...resolve(n)} />
      ))}
    </div>
  );
}
