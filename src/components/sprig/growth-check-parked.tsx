/**
 * PARKED UI — built, working, and not yet reachable.
 *
 * These components were live on the Progress page while it ran on invented
 * data. When that page was rewired to real progress they lost their data
 * source, because they need `test_attempts` and nothing wrote to that table.
 *
 * They are kept here rather than deleted because they are finished design
 * work, and rebuilding them from scratch later would be wasted effort. Git
 * history would have preserved them too, but only for someone who knew to go
 * looking; a file you can open is a much better reminder than a commit you
 * have to remember.
 *
 * THE GROWTH CHART HAS LEFT THIS FILE. The baseline and Growth Check flows now
 * write real attempts, so it moved to GrowthChart.tsx and is live on the
 * Progress page. What remains parked is the *historical* missed-questions
 * section, which is a harder problem than it looks: the end-of-test results
 * screen can show missed questions because it still holds them in memory, but
 * rebuilding that list weeks later means taking the question ids out of
 * `test_attempts.answers` and joining them back to `questions` for the text,
 * answer and explanation. That query isn't written yet.
 *
 * WHY EVERYTHING IS EXPORTED: `noUnusedLocals` is on, so an unexported
 * function nobody calls fails the build. Exporting is what lets finished-but-
 * unwired code sit in the repo without either breaking compilation or being
 * quietly deleted.
 *
 * TO BRING BACK: import into src/pages/Progress.tsx and feed MissedCardView one
 * MissedCard per wrong-or-unsure answer, sourced from the join described above.
 */

export type MissedCard = {
  id: string;
  question: string;
  answer: string;
  explanation: string;
  source: "progress" | "growth";
  topic: string;
};

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
