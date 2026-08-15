/**
 * No longer parked — imported straight into src/pages/Progress.tsx.
 *
 * These components were built while the Progress page still ran on invented
 * data, then lost their data source when that page was rewired to real
 * completions, because they need `test_attempts` and nothing wrote to that
 * table yet. The name and this file stuck around rather than being renamed,
 * since it's still an accurate record of why the join was missing for as long
 * as it was: the end-of-test results screen could show missed questions
 * because it still held them in memory, but rebuilding that list weeks later
 * meant taking the question ids out of `test_attempts.answers` and joining
 * them back to `questions` — that's `src/lib/testMastery.ts` +
 * `fetchQuestionsByIds()` in `src/lib/questions.ts` now.
 *
 * THE GROWTH CHART LEFT THIS FILE EARLIER. It moved to GrowthChart.tsx once
 * the baseline/Growth Check flow started writing real attempts.
 */

export type MissedCardSource = "baseline" | "progress" | "growth";

export type MissedCard = {
  id: string;
  question: string;
  answer: string;
  explanation: string;
  source: MissedCardSource;
  topic: string;
};

/**
 * One entry per test type, so the card badge and the legend cannot drift apart
 * and adding a fourth type later is a one-line change.
 *
 * `baseline` used to be missing here, and Progress.tsx collapsed it into
 * "growth" with a single `=== "progress_check" ? … : …` ternary. The effect was
 * that a student's very first missed questions — necessarily from the baseline,
 * since it is the first test anyone takes — were all labelled "Missed on a
 * Growth Check", a test they had not taken. Three cases do not fit in a
 * boolean.
 */
const SOURCE_STYLE: Record<MissedCardSource, { label: string; legend: string; color: string }> = {
  baseline: {
    label: "Baseline",
    legend: "Missed on your baseline",
    color: "var(--terracotta)",
  },
  progress: {
    label: "Progress",
    legend: "Missed on a Progress Check",
    color: "var(--forest-soft)",
  },
  growth: {
    label: "Growth",
    legend: "Missed on a Growth Check",
    color: "var(--forest)",
  },
};

/* ---------- Missed cards ---------- */

export function Legend() {
  return (
    <div className="hidden shrink-0 flex-col gap-2 md:flex">
      {(Object.keys(SOURCE_STYLE) as MissedCardSource[]).map((source) => (
        <LegendRow key={source} color={SOURCE_STYLE[source].color} label={SOURCE_STYLE[source].legend} />
      ))}
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
  const style = SOURCE_STYLE[card.source];
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {card.topic}
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]"
          style={{
            backgroundColor: `color-mix(in oklab, ${style.color} 18%, transparent)`,
            color: "var(--forest)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.color }} />
          {style.label}
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
