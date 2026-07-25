import { useMemo, useState } from "react";

/**
 * PARKED UI — built, working, and not yet reachable.
 *
 * These components were live on the Progress page while it ran on invented
 * data: a seven-point Growth Check line chart with hover tooltips, and the
 * cards for questions you got wrong. When that page was rewired to real
 * progress they lost their data source, because both need `test_attempts` and
 * nothing writes to that table yet -- the Progress Check and Growth Check
 * flows don't exist.
 *
 * They are kept here rather than deleted because they are finished design
 * work, and rebuilding them from scratch later would be wasted effort. Git
 * history would have preserved them too, but only for someone who knew to go
 * looking; a file you can open is a much better reminder than a commit you
 * have to remember.
 *
 * WHY EVERYTHING IS EXPORTED: `noUnusedLocals` is on, so an unexported
 * function nobody calls fails the build. Exporting is what lets finished-but-
 * unwired code sit in the repo without either breaking compilation or being
 * quietly deleted.
 *
 * TO BRING BACK: import into src/pages/Progress.tsx and feed real rows --
 * GrowthChart wants one GrowthPoint per attempt (`test_type = 'growth_check'`,
 * score as a 0-100 number), MissedCardView one MissedCard per wrong answer,
 * which needs per-question answers stored on the attempt.
 *
 * Unchanged from the last version that shipped, apart from the two prop types:
 * they used to be `typeof GROWTH_POINTS` and inferred from mock arrays that no
 * longer exist, so they are now declared properly.
 */

/** One Growth Check result. `date` is a short display label, e.g. "12 Sep". */
export type GrowthPoint = { week: string; date: string; score: number };

export type MissedCard = {
  id: string;
  question: string;
  answer: string;
  explanation: string;
  source: "progress" | "growth";
  topic: string;
};

/* ---------- Growth chart ---------- */

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
    () => points.map((_, i) => padL + (i / (points.length - 1)) * innerW),
    [points, innerW]
  );
  const ys = useMemo(
    () => points.map((p) => padT + innerH - (p.score / 100) * innerH),
    [points, innerH]
  );

  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
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
        <path
          d={linePath}
          fill="none"
          stroke="var(--forest)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

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


/* ---------- Missed cards ---------- */

export function Legend() {
  return (
    <div className="hidden shrink-0 flex-col gap-2 md:flex">
      <LegendRow color="var(--forest-soft)" label="Missed on a Progress Check" />
      <LegendRow color="var(--forest)" label="Missed on a Growth Check" />
    </div>
  );
}

export function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function MissedCardView({ card }: { card: MissedCard }) {
  const isProgress = card.source === "progress";
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {card.topic}
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{
            backgroundColor: isProgress
              ? "color-mix(in oklab, var(--forest-soft) 22%, transparent)"
              : "color-mix(in oklab, var(--forest) 15%, transparent)",
            color: isProgress ? "var(--forest)" : "var(--forest)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: isProgress ? "var(--forest-soft)" : "var(--forest)" }}
          />
          {isProgress ? "Progress" : "Growth"}
        </span>
      </div>

      <h3 className="mt-4 font-display text-[19px] font-normal leading-[1.3] tracking-[-0.01em]">
        {card.question}
      </h3>

      <div className="mt-5 border-t border-border pt-4">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-forest">
          Correct answer
        </div>
        <p className="mt-2 text-[14px] leading-[1.6] text-foreground/90">{card.answer}</p>
        <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
          {card.explanation}
        </p>
      </div>
    </article>
  );
}
