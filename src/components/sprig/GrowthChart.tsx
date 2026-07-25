import { useMemo, useState } from "react";

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
 */

/** One Growth Check result. `date` is a short display label, e.g. "12 Sep". */
export type GrowthPoint = { week: string; date: string; score: number };

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

  const linePath =
    points.length > 1 ? xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ") : "";
  const yTicks = [0, 25, 50, 75, 100];

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

        {/* line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--forest)"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* dots */}
        {points.map((p, i) => (
          <g key={p.week}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={hover === i ? 6 : 4}
              fill="var(--cream)"
              stroke="var(--forest)"
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
        ))}
      </svg>

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
          <div className="mt-0.5 font-display text-[15px] leading-none text-forest">
            {points[hover].score}%
          </div>
        </div>
      )}
    </div>
  );
}
