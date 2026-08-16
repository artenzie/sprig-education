import { useMemo, useState } from "react";
import { LegendRow } from "@/components/sprig/growth-check-parked";

/**
 * The Growth Check line chart.
 *
 * This was parked in growth-check-parked.tsx while nothing wrote to
 * `test_attempts`. Now that the baseline and Growth Check flows exist it has
 * real rows to plot, so it moves back into a file named after what it is. The
 * cards for missed questions are still parked, because the historical version
 * of that section needs question ids joined back to `questions` and that isn't
 * built yet.
 *
 * ONE REAL FIX ON THE WAY BACK IN. The x positions were
 * `padL + (i / (points.length - 1)) * innerW`, which divides by zero when
 * there is exactly one point -- producing NaN coordinates and a chart that
 * renders nothing. That was unreachable while the data was a seven-point mock
 * array, and is now the *first* thing every student will hit: the moment after
 * their baseline, they have precisely one attempt. A single point is centred
 * instead, and the line path is skipped, since a line between one point and
 * itself is not a thing.
 *
 * COLOUR (Aug 2026). Every stroke on this chart used to be `var(--forest)`,
 * which meant the one visual channel a line chart has spare was spent saying
 * nothing. It now carries the two things a student actually wants to read off
 * a growth chart:
 *
 *   - where they STARTED -- the baseline dot, in bark, filled rather than
 *     hollow, because it is the reference every later point is measured
 *     against and not itself a result;
 *   - which way each check MOVED -- each segment is forest if the score rose
 *     or held, terracotta if it fell.
 *
 * Direction rather than absolute score, deliberately. Colouring by score band
 * (red under 50%, green over 75%) was the obvious alternative and is the wrong
 * thing to show a 13-year-old: it paints a verdict on the number itself, so a
 * student improving from 30% to 45% would watch their chart stay in the
 * warning colour the whole way up. Direction rewards the movement, which is
 * the only thing they control.
 */

/** One Growth Check result. `date` is a short display label, e.g. "12 Sep". */
export type GrowthPoint = {
  week: string;
  date: string;
  score: number;
  /**
   * Which test produced this point. Only the baseline is treated specially --
   * it is the one point with nothing before it to compare against -- but it
   * has to be passed in rather than inferred from the index, because a student
   * whose first attempt failed to save would otherwise have their earliest
   * Growth Check silently relabelled as a baseline.
   */
  kind: "baseline" | "growth_check";
};

const BASELINE_COLOR = "var(--bark)";
const RISE_COLOR = "var(--forest)";
const DIP_COLOR = "var(--terracotta)";

/**
 * The colour of the point at index `i`: the direction it moved from the point
 * before it. Equal scores count as a rise -- holding steady is not a fall, and
 * a student who scores identically twice should not be shown a warning colour
 * for it.
 */
function pointColor(points: GrowthPoint[], i: number): string {
  if (i === 0 || points[i].kind === "baseline") return BASELINE_COLOR;
  return points[i].score >= points[i - 1].score ? RISE_COLOR : DIP_COLOR;
}

export function GrowthChart({ points }: { points: GrowthPoint[] }) {
  const W = 1120;
  const H = 340;
  const padL = 48;
  const padR = 24;
  const padT = 24;
  const padB = 44;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const [hover, setHover] = useState<number | null>(null);

  const xs = useMemo(
    () =>
      points.map((_, i) =>
        // See the note above: one point is centred rather than divided by zero.
        points.length === 1 ? padL + innerW / 2 : padL + (i / (points.length - 1)) * innerW,
      ),
    [points, innerW],
  );
  const ys = useMemo(
    () => points.map((p) => padT + innerH - (p.score / 100) * innerH),
    [points, innerH]
  );

  // One path per segment rather than a single polyline, so each leg can carry
  // its own colour. A segment is named for the point it ARRIVES at, which is
  // also the point whose dot it colours -- so the leg and the dot at its end
  // always agree.
  const segments = useMemo(
    () =>
      points.slice(1).map((_, idx) => {
        const i = idx + 1;
        return {
          key: points[i].week,
          d: `M ${xs[i - 1]} ${ys[i - 1]} L ${xs[i]} ${ys[i]}`,
          color: pointColor(points, i),
        };
      }),
    [points, xs, ys],
  );

  const yTicks = [0, 25, 50, 75, 100];

  // Only advertise a colour that is actually on screen. A student who has
  // never had a dip should not be shown a "dipped" key for a colour their
  // chart does not contain.
  const hasDip = segments.some((s) => s.color === DIP_COLOR);
  const hasRise = segments.some((s) => s.color === RISE_COLOR);
  const hasBaseline = points.some((_, i) => pointColor(points, i) === BASELINE_COLOR);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Growth over time">
        {/* subtle horizontal gridlines */}
        {yTicks.map((t) => {
          const y = padT + innerH - (t / 100) * innerH;
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={t === 0 ? "0" : "2 4"}
                opacity={t === 0 ? 0.9 : 0.6}
              />
              <text
                x={padL - 12}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                style={{ fontFamily: "var(--font-sans)", fontSize: 10.5, letterSpacing: "0.14em" }}
              >
                {t}%
              </text>
            </g>
          );
        })}

        {/* x labels */}
        {points.map((p, i) => (
          <text
            key={p.week}
            x={xs[i]}
            y={H - padB + 22}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontFamily: "var(--font-sans)", fontSize: 10.5, letterSpacing: "0.14em" }}
          >
            {p.week}
          </text>
        ))}

        {/* line, one coloured leg at a time */}
        {segments.map((seg) => (
          <path
            key={seg.key}
            d={seg.d}
            fill="none"
            stroke={seg.color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* dots */}
        {points.map((p, i) => {
          const color = pointColor(points, i);
          const isBaseline = color === BASELINE_COLOR;
          return (
            <g key={p.week}>
              <circle
                cx={xs[i]}
                cy={ys[i]}
                r={hover === i ? 6 : 4}
                // The baseline is filled solid; every later point is hollow.
                // Shape as well as colour, so the "you started here" marker is
                // still distinguishable to a colour-blind reader.
                fill={isBaseline ? color : "var(--cream)"}
                stroke={color}
                strokeWidth={1.8}
                style={{ transition: "r 120ms ease" }}
              />
              {/* hover target */}
              <circle
                cx={xs[i]}
                cy={ys[i]}
                r={18}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}
      </svg>

      {(hasBaseline || hasRise || hasDip) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {hasBaseline && <LegendRow color={BASELINE_COLOR} label="Where you started" />}
          {hasRise && <LegendRow color={RISE_COLOR} label="Moved up" />}
          {hasDip && <LegendRow color={DIP_COLOR} label="Moved down" />}
        </div>
      )}

      {/* tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-border bg-background px-3 py-2 text-[11.5px] leading-tight shadow-[0_6px_20px_-12px_rgba(0,0,0,0.25)]"
          style={{
            left: `${(xs[hover] / W) * 100}%`,
            top: `${(ys[hover] / H) * 100}%`,
            marginTop: -14,
          }}
        >
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {points[hover].date}
          </div>
          <div
            className="mt-0.5 font-display text-[15px] leading-none"
            style={{ color: pointColor(points, hover) }}
          >
            {points[hover].score}%
          </div>
          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {hover === 0 || points[hover].kind === "baseline"
              ? "Baseline"
              : formatDelta(points[hover].score - points[hover - 1].score)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "+8.3 pts" / "-4 pts" / "No change".
 *
 * Points, not percent. The scores are already percentages, so a rise from 44%
 * to 52% is 8 percentage POINTS, not 8 percent -- calling it "+8%" would be
 * quietly wrong on a page whose whole job is teaching a student to read
 * numbers about money carefully.
 */
function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return "No change";
  return `${rounded > 0 ? "+" : ""}${rounded} pts`;
}
