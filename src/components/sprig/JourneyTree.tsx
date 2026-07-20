import { Check, Lock } from "lucide-react";

// -----------------------------------------------------------------------------
// Hand-drawn botanical journey tree
// -----------------------------------------------------------------------------
// Layout is designed on a 2000 x 2700 viewBox with the trunk centered at x=1000.
// Trunk & canopy branches are drawn as FILLED tapered ribbons (not strokes) so
// they read as an organic limb: thick at the base, thinning as they rise.
// Node positions on the canopy are sampled along the actual cubic Béziers used
// to draw those branches, so the dots sit exactly on the line.
// -----------------------------------------------------------------------------

type Status = "complete" | "current" | "locked";
type Kind = "lesson" | "milestone";

type Node = {
  id: string;
  x: number;
  y: number;
  chapter: string;
  title: string;
  titleLines?: [string, string];
  kind: Kind;
  status: Status;
  minutes?: number;
  side: "left" | "right";
};

const VBW = 2000;
const VBH = 2700;

const TRUNK_X = 1000;
const GROUND_Y = 2570;
const TRUNK_BASE_Y = 2560;
const FORK_Y = 1590;

// --- Trunk (tapered filled ribbon) ------------------------------------------
// Full trunk silhouette. Wider at the ground, narrowing toward the fork.
// Trunk — asymmetric, hand-drawn taper. Slight bulges break the mirror symmetry.
const TRUNK_PATH = `
  M 960 ${TRUNK_BASE_Y}
  C 964 2360, 974 2100, 978 1900
  C 981 1780, 984 1660, 986 ${FORK_Y}
  L 1014 ${FORK_Y}
  C 1016 1660, 1019 1780, 1023 1900
  C 1028 2100, 1036 2360, 1040 ${TRUNK_BASE_Y}
  Z
`;

// A softer inner shade so the trunk feels three-dimensional rather than flat.
const TRUNK_INNER_PATH = `
  M 990 ${TRUNK_BASE_Y - 8}
  C 993 2350, 999 2100, 1001 1900
  C 1002 1780, 1002 1660, 1002 ${FORK_Y + 4}
  L 1010 ${FORK_Y + 4}
  C 1011 1660, 1012 1780, 1014 1900
  C 1017 2100, 1021 2350, 1023 ${TRUNK_BASE_Y - 8}
  Z
`;

// --- Canopy branches --------------------------------------------------------
// Each branch is a filled ribbon with a multi-segment outer edge and a
// separate multi-segment inner edge. Multiple cubic segments per side give
// the curves a hand-drawn, irregular quality — no two branches share the
// same shape, angle, or length. Widths taper naturally from ~26 at the fork
// to ~7 at the tip.

// Left branch — long sweeping S-curve reaching far up and out.
const BRANCH_L = `
  M 978 1602
  C 820 1522, 660 1442, 560 1332
  C 470 1236, 402 1140, 360 1020
  C 322 902, 282 760, 246 590
  C 236 502, 232 432, 226 378
  L 254 384
  C 260 434, 262 504, 272 592
  C 302 760, 338 900, 374 1020
  C 410 1140, 478 1234, 568 1330
  C 664 1440, 822 1520, 998 1596
  Z
`;

// Middle branch — subtle S-sway leaning slightly right, shorter kinks than the sides.
const BRANCH_M = `
  M 985 1592
  C 970 1400, 1020 1190, 1004 985
  C 992 830, 984 620, 1005 380
  L 1023 380
  C 1002 620, 1010 830, 1022 985
  C 1038 1190, 988 1400, 1005 1592
  Z
`;

// Right branch — shorter than the left, different arc, kinked mid-way.
const BRANCH_R = `
  M 1022 1602
  C 1200 1530, 1362 1462, 1462 1342
  C 1542 1244, 1592 1132, 1632 1002
  C 1672 862, 1692 720, 1712 442
  L 1698 440
  C 1678 720, 1656 858, 1616 998
  C 1576 1130, 1526 1240, 1446 1338
  C 1348 1458, 1188 1526, 1002 1596
  Z
`;

// (Whisker twigs removed — they read as floating branch fragments.)
const TWIGS: string[] = [];


// --- Nodes ------------------------------------------------------------------

const nodes: Node[] = [
  // Trunk — Tier I "Essentials", bottom to top
  { id: "t1", x: TRUNK_X, y: 2400, chapter: "I.I",   title: "The Psychology of Spending",                kind: "lesson", status: "complete", side: "right" },
  { id: "t2", x: TRUNK_X, y: 2225, chapter: "I.II",  title: "Where Money Really Comes From",             kind: "lesson", status: "complete", side: "left"  },
  { id: "t3", x: TRUNK_X, y: 2050, chapter: "I.III", title: "Making Money Decisions With What You Have", titleLines: ["Making Money Decisions", "With What You Have"], kind: "lesson", status: "complete", side: "right" },
  { id: "t4", x: TRUNK_X, y: 1875, chapter: "I.IV",  title: "How Banks and Money Actually Work",         titleLines: ["How Banks and Money", "Actually Work"], kind: "lesson", status: "current", minutes: 9, side: "left" },
  { id: "t5", x: TRUNK_X, y: 1700, chapter: "I.V",   title: "Setting a Goal That Actually Matters to You", titleLines: ["Setting a Goal That", "Actually Matters to You"], kind: "lesson", status: "locked", side: "right" },
  { id: "tm", x: TRUNK_X, y: 1560, chapter: "I",     title: "Essentials",                                kind: "milestone", status: "locked", side: "left" },

  // Left canopy — Application (sampled evenly along branch centerline)
  { id: "l1", x: 761,  y: 1483, chapter: "II.I",   title: "Budgeting Basics",                kind: "lesson", status: "locked", side: "left" },
  { id: "l2", x: 561,  y: 1327, chapter: "II.II",  title: "How Pricing Tricks You",          kind: "lesson", status: "locked", side: "left" },
  { id: "l3", x: 410,  y: 1122, chapter: "II.III", title: "Subscriptions & Recurring Costs", titleLines: ["Subscriptions &", "Recurring Costs"], kind: "lesson", status: "locked", side: "left" },
  { id: "l4", x: 327,  y: 882,  chapter: "II.IV",  title: "Buy Now, Pay Later",              kind: "lesson", status: "locked", side: "left" },
  { id: "l5", x: 268,  y: 634,  chapter: "II.V",   title: "Scams & Financial Safety",        titleLines: ["Scams &", "Financial Safety"], kind: "lesson", status: "locked", side: "left" },
  { id: "lm", x: 240,  y: 381,  chapter: "II",     title: "Application",                     kind: "milestone", status: "locked", side: "left" },

  // Middle canopy — Mathematics
  { id: "m1", x: 995,  y: 1390, chapter: "III.I",   title: "Percentages in Real Life",       titleLines: ["Percentages in", "Real Life"], kind: "lesson", status: "locked", side: "left" },
  { id: "m2", x: 1010, y: 1188, chapter: "III.II",  title: "Simple Interest",                kind: "lesson", status: "locked", side: "right" },
  { id: "m3", x: 1013, y: 986,  chapter: "III.III", title: "Compound Interest Intuitively",  titleLines: ["Compound Interest", "Intuitively"], kind: "lesson", status: "locked", side: "left" },
  { id: "m4", x: 1010, y: 784,  chapter: "III.IV",  title: "Inflation Basics",               kind: "lesson", status: "locked", side: "right" },
  { id: "m5", x: 1007, y: 582,  chapter: "III.V",   title: "Why Some Choices Are Riskier",   titleLines: ["Why Some Choices", "Are Riskier"], kind: "lesson", status: "locked", side: "left" },
  { id: "mm", x: 1014, y: 380,  chapter: "III",     title: "Mathematics",                    kind: "milestone", status: "locked", side: "left" },

  // Right canopy — Mastery
  { id: "r1", x: 1238, y: 1505, chapter: "IV.I",   title: "Budget Calculator (Python)",          titleLines: ["Budget Calculator", "(Python)"], kind: "lesson", status: "locked", side: "right" },
  { id: "r2", x: 1436, y: 1362, chapter: "IV.II",  title: "The Real Compound Interest Formula", titleLines: ["The Real Compound", "Interest Formula"], kind: "lesson", status: "locked", side: "right" },
  { id: "r3", x: 1571, y: 1160, chapter: "IV.III", title: "Present & Future Value",             kind: "lesson", status: "locked", side: "right" },
  { id: "r4", x: 1647, y: 926,  chapter: "IV.IV",  title: "Behavioural Finance",                kind: "lesson", status: "locked", side: "right" },
  { id: "r5", x: 1688, y: 685,  chapter: "IV.V",   title: "Introduction to Crypto",             kind: "lesson", status: "locked", side: "right" },
  { id: "rm", x: 1705, y: 441,  chapter: "IV",     title: "Mastery",                            kind: "milestone", status: "locked", side: "right" },
];

// --- Leaves -----------------------------------------------------------------

type LeafSpec = { cx: number; cy: number; rot: number; s?: number; grown: boolean };

// Attached leaves along the grown (completed) part of the trunk.
const LEAVES_GROWN: LeafSpec[] = [
  { cx: 1092, cy: 2082, rot: 30,   grown: true },
  { cx: 908,  cy: 1942, rot: -152, grown: true },
  { cx: 1090, cy: 1802, rot: 24,   grown: true, s: 0.9 },
  { cx: 1060, cy: 2020, rot: 40,   grown: true, s: 0.8 },
  { cx: 942,  cy: 2170, rot: -150, grown: true, s: 0.85 },
];

// Dormant leaves scattered sparsely across the canopy limbs.
const LEAVES_DORMANT: LeafSpec[] = [
  { cx: 914,  cy: 1666, rot: -155, grown: false, s: 0.9 },
  // left canopy
  { cx: 710,  cy: 1252, rot: -60, grown: false },
  { cx: 390,  cy: 1142, rot: -70, grown: false, s: 0.9 },
  { cx: 242,  cy: 722,  rot: -80, grown: false },
  { cx: 268,  cy: 500,  rot: -60, grown: false, s: 0.85 },
  // middle canopy
  { cx: 1028, cy: 1270, rot: 30,  grown: false, s: 0.9 },
  { cx: 972,  cy: 852,  rot: -30, grown: false },
  { cx: 1024, cy: 520,  rot: 25,  grown: false, s: 0.85 },
  // right canopy (repositioned along the new shorter, lower right branch)
  { cx: 1360, cy: 1370, rot: 60,  grown: false },
  { cx: 1480, cy: 1200, rot: 70,  grown: false, s: 0.9 },
  { cx: 1580, cy: 990,  rot: 75,  grown: false },
  { cx: 1652, cy: 740,  rot: 80,  grown: false, s: 0.9 },
  { cx: 1695, cy: 520,  rot: 60,  grown: false, s: 0.85 },
];

// Fallen leaves: a couple of loose singles + two small piles at the base.
const LEAVES_FALLEN: LeafSpec[] = [
  // Left pile — clustered
  { cx: 812, cy: GROUND_Y + 20, rot: -55, grown: false, s: 0.75 },
  { cx: 828, cy: GROUND_Y + 34, rot: 20,  grown: false, s: 0.7  },
  { cx: 848, cy: GROUND_Y + 24, rot: 80,  grown: false, s: 0.65 },
  { cx: 866, cy: GROUND_Y + 40, rot: -30, grown: false, s: 0.72 },
  { cx: 884, cy: GROUND_Y + 28, rot: 45,  grown: false, s: 0.6  },
  // Right pile — clustered
  { cx: 1122, cy: GROUND_Y + 22, rot: 40,  grown: false, s: 0.74 },
  { cx: 1146, cy: GROUND_Y + 38, rot: -20, grown: false, s: 0.68 },
  { cx: 1170, cy: GROUND_Y + 26, rot: 90,  grown: false, s: 0.62 },
  { cx: 1194, cy: GROUND_Y + 42, rot: -70, grown: false, s: 0.7  },
  { cx: 1218, cy: GROUND_Y + 28, rot: 15,  grown: false, s: 0.6  },
  // A few scattered singles drifting slightly farther out
  { cx: 700,  cy: GROUND_Y + 36, rot: 25,  grown: false, s: 0.6  },
  { cx: 660,  cy: GROUND_Y + 48, rot: -40, grown: false, s: 0.55 },
  { cx: 1280, cy: GROUND_Y + 40, rot: -15, grown: false, s: 0.62 },
  { cx: 1320, cy: GROUND_Y + 30, rot: 60,  grown: false, s: 0.55 },
];

function Leaf({ cx, cy, rot, s = 1, grown }: LeafSpec) {
  const stroke = grown ? "var(--forest)" : "oklch(0.82 0.05 152)";
  const fill = grown
    ? "color-mix(in oklab, var(--forest) 22%, transparent)"
    : "color-mix(in oklab, oklch(0.82 0.05 152) 30%, transparent)";
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${s})`}>
      <path
        d="M 0 -13 C 6 -9, 7 -2, 0 13 C -7 -2, -6 -9, 0 -13 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={0.9}
        strokeLinejoin="round"
      />
      <path d="M 0 -12 L 0 12" stroke={stroke} strokeWidth={0.55} opacity={0.85} />
    </g>
  );
}

// --- Main --------------------------------------------------------------------

export function JourneyTree() {
  return (
    <div className="relative mx-auto w-full" style={{ aspectRatio: `${VBW} / ${VBH}` }}>
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <pattern id="soil" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="oklch(0.65 0.04 155)" opacity="0.35" />
            <circle cx="6" cy="5" r="0.4" fill="oklch(0.65 0.04 155)" opacity="0.28" />
          </pattern>
        </defs>

        {/* Ground line + roots */}
        <path
          d={`M 120 ${GROUND_Y} C 400 ${GROUND_Y - 4}, 700 ${GROUND_Y + 4}, ${TRUNK_X} ${GROUND_Y} C 1300 ${GROUND_Y - 4}, 1600 ${GROUND_Y + 4}, 1880 ${GROUND_Y}`}
          stroke="oklch(0.7 0.03 145)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        />
        <g stroke="var(--forest)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.75">
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 960 2586, 900 2604, 840 2612`} />
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 1040 2586, 1100 2604, 1160 2612`} />
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 996 2596, 992 2620, 994 2640`} />
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 950 2596, 890 2602, 850 2600`} opacity="0.55" />
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 1050 2596, 1110 2602, 1150 2600`} opacity="0.55" />
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 970 2590, 940 2598, 910 2598`} opacity="0.4" />
          <path d={`M ${TRUNK_X} ${TRUNK_BASE_Y} C 1030 2590, 1060 2598, 1090 2598`} opacity="0.4" />
        </g>

        {/* Faint stippled canopy backdrop */}
        <ellipse cx={TRUNK_X} cy="820" rx="880" ry="560" fill="url(#soil)" opacity="0.25" />

        {/* Canopy branches — dormant tapered ribbons */}
        <g fill="var(--mint, #CDE8D4)" stroke="oklch(0.78 0.05 152)" strokeWidth="0.6" strokeLinejoin="round">
          <path d={BRANCH_L} />
          <path d={BRANCH_M} />
          <path d={BRANCH_R} />
        </g>

        {/* Trunk — tapered filled ribbon, forest green */}
        <g strokeLinejoin="round">
          <path d={TRUNK_PATH} fill="var(--forest)" stroke="var(--forest)" strokeWidth="0.6" />
          <path d={TRUNK_INNER_PATH} fill="color-mix(in oklab, var(--forest) 82%, black)" opacity="0.35" />
        </g>

        {/* Small hand-drawn twigs */}
        <g fill="none" stroke="var(--forest)" strokeLinecap="round" opacity="0.55">
          {TWIGS.map((d, i) => <path key={i} d={d} strokeWidth={1.1} />)}
        </g>

        {/* Leaves */}
        {LEAVES_DORMANT.map((l, i) => <Leaf key={`d${i}`} {...l} />)}
        {LEAVES_GROWN.map((l, i) => <Leaf key={`g${i}`} {...l} />)}
        {LEAVES_FALLEN.map((l, i) => <Leaf key={`f${i}`} {...l} />)}

        {/* Milestone headers — Essentials beside the trunk I circle; Application/Mathematics/Mastery on a shared baseline high above the canopy circles */}
        {[
          { x: 240,  y: 225,  label: "Application", anchor: "middle" as const },
          { x: 1014, y: 225,  label: "Mathematics", anchor: "middle" as const },
          { x: 1705, y: 225,  label: "Mastery",     anchor: "middle" as const },
          { x: 880,  y: 1720, label: "Essentials",  anchor: "end"    as const },
        ].map(({ x, y, label, anchor }) => {
          const fontSize = 44;
          const w = label.length * (fontSize * 0.34);
          const x1 = anchor === "end" ? x - w : x - w / 2;
          const x2 = anchor === "end" ? x     : x + w / 2;
          return (
            <g key={label}>
              <text
                x={x}
                y={y}
                textAnchor={anchor}
                fill="#2C4A38"
                fontFamily="var(--font-display, 'Fraunces', serif)"
                fontStyle="italic"
                fontSize={fontSize}
                fontWeight={400}
                letterSpacing="-0.5"
              >
                {label}
              </text>
              <line
                x1={x1}
                x2={x2}
                y1={y + 12}
                y2={y + 12}
                stroke="#2C4A38"
                strokeWidth={1.2}
                opacity={0.6}
              />
            </g>
          );
        })}
      </svg>

      {/* Node overlay */}
      {nodes.map((n) => (
        <LessonMark key={n.id} node={n} />
      ))}
    </div>
  );
}

// --- Node overlay -----------------------------------------------------------

function LessonMark({ node }: { node: Node }) {
  const isMilestone = node.kind === "milestone";
  const size = isMilestone ? 46 : 22;
  const titleLines = node.titleLines ?? [node.title];

  // Dot styling
  let dotClass = "";
  if (isMilestone) {
    dotClass = "bg-[#2C4A38] text-white border border-[#1E3527] shadow-[0_2px_6px_-2px_rgba(20,40,25,0.4)]";
  } else if (node.status === "complete") {
    dotClass = "bg-forest text-primary-foreground";
  } else if (node.status === "current") {
    dotClass = "bg-forest text-primary-foreground sprig-glow ring-2 ring-terracotta/60 ring-offset-2 ring-offset-background";
  } else {
    dotClass = "bg-cream text-muted-foreground border border-border";
  }

  const labelSide = node.side;
  const gap = isMilestone
    ? size / 2 + 22
    : size / 2 + (node.status === "current" ? 58 : 30);
  const labelWidth = isMilestone ? 180 : 200;

  // Milestone label placement:
  // - "Essentials" (tm) sits to the LEFT of the trunk milestone circle.
  // - Canopy milestones (II, III, IV) sit centered ABOVE their circle.
  // Canopy milestones (lm/mm/rm) render their label as SVG text above the circle.
  const milestoneLeft = isMilestone && node.id === "tm";
  const suppressLabel = isMilestone;

  return (
    <div
      className="absolute"
      style={{
        left: `${(node.x / VBW) * 100}%`,
        top: `${(node.y / VBH) * 100}%`,
      }}
    >
      {suppressLabel ? null : (
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ [milestoneLeft || labelSide === "left" ? "right" : "left"]: gap } as React.CSSProperties}
        >
          <div
            className={`${milestoneLeft || labelSide === "left" ? "text-right" : "text-left"} ${
              !isMilestone && node.status === "locked" ? "opacity-60" : ""
            }`}
            style={{ width: labelWidth }}
          >
            {!isMilestone && (
              <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
                {node.chapter}
                {node.status === "current" && (
                  <span className="ml-2 text-terracotta">Now</span>
                )}
              </div>
            )}
            <div
              className={
                isMilestone
                  ? "font-display italic text-[22px] leading-none tracking-[-0.01em] text-[#2C4A38] whitespace-nowrap"
                  : `mt-0.5 text-[12.5px] leading-[1.28] ${
                      node.status === "current" ? "text-forest font-semibold" : "text-foreground"
                    }`
              }
            >
              {titleLines.map((line) => (
                <span key={line} className="block whitespace-nowrap">
                  {line}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dot */}
      <button
        aria-label={node.title}
        disabled={node.status === "locked"}
        className={`relative -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-transform ${dotClass} ${
          node.status === "current" ? "scale-110" : ""
        }`}
        style={{ width: size, height: size }}
      >
        {isMilestone ? (
          <span className="font-display italic text-[15px]">{node.chapter}</span>
        ) : node.status === "complete" ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        ) : node.status === "current" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        ) : (
          <Lock className="h-2.5 w-2.5" />
        )}
      </button>
    </div>
  );
}
