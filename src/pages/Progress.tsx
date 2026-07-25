import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { useJourney } from "@/hooks/useJourney";
import type { JourneyTopic } from "@/lib/journey";

/**
 * WHAT THIS PAGE CAN AND CANNOT SHOW YET
 *
 * This page used to run entirely on invented data: seven weekly Growth Check
 * scores, five per-topic "mastery" percentages, and five missed questions with
 * written explanations. All of it was fabricated, and none of it can be
 * recovered from what the app actually stores.
 *
 * The reason is worth understanding, because it is a modelling limit rather
 * than a missing query. `progress` records THAT a subtopic was finished --
 * one row, no score. It has no idea how many questions were answered
 * correctly, which ones were missed, or when a test was taken. Those belong to
 * `test_attempts`, and nothing writes to that table because the Progress Check
 * and Growth Check flows do not exist yet.
 *
 * So this page now shows real completion, and says plainly that the rest
 * hasn't happened yet. The temptation was to relabel completion as "mastery"
 * and keep the bars looking full -- that would have made the page look
 * finished while showing a number that does not mean what it says.
 *
 * The UI for the missing half is not gone. The Growth Check line chart and the
 * missed-question cards are parked, intact, in
 * src/components/sprig/growth-check-parked.tsx -- import them back here once
 * test_attempts has rows to feed them.
 */

/* ---------- Page ---------- */

function ProgressPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const { journey, loading } = useJourney();

  // Only topics with content the student has actually started or finished --
  // there is nothing to revisit in a topic they have never opened.
  const startedTopics = journey.topics.filter((t) => t.hasContent && t.completedCount > 0);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />

      <main className="mx-auto max-w-[1240px] px-8 pb-32 pt-14">
        {/* Page header */}
        <div className="flex items-end justify-between gap-8">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              Progress · Tier I
            </div>
            <h1 className="mt-3 font-display text-[52px] font-normal leading-[1.02] tracking-[-0.03em]">
              How you're <em className="italic text-forest">growing</em>.
            </h1>
          </div>
          <Link
            to="/dashboard"
            className="hidden shrink-0 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-forest md:inline-flex"
          >
            ← Back to journey
          </Link>
        </div>

        <Divider />

        {/* SECTION 1 — Growth Check */}
        <section>
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="font-display text-[34px] font-normal leading-[1.1] tracking-[-0.02em]">
                Your growth
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                Every few weeks you take a Growth Check — a short test across everything
                you've covered so far. This is how your overall understanding has moved
                since your very first baseline.
              </p>
            </div>
            <button
              disabled
              title="Growth Checks aren't built yet"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-6 py-3 text-[13.5px] font-medium text-muted-foreground"
            >
              Take Growth Check
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-10">
            <EmptyPanel
              title="No Growth Checks yet"
              body="Once you've taken your first Growth Check, this is where you'll watch your score move over the term."
            />
          </div>
        </section>

        <Divider />

        {/* SECTION 2 — Progress by topic */}
        <section>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {startedTopics.length > 0 ? (
              <TopicBars topics={startedTopics} />
            ) : (
              <EmptyPanel
                title="Nothing to show yet"
                body="Finish a lesson and this fills in with the topics you've covered."
              />
            )}

            <div className="flex flex-col">
              <h2 className="font-display text-[34px] font-normal leading-[1.1] tracking-[-0.02em]">
                Your topics
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                How far you've worked through each topic you've started. Pick any
                combination below and take a focused Progress Check — a short test on
                just those topics.
              </p>

              <div className="mt-8">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
                  Choose what to revisit
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {startedTopics.length === 0 && (
                    <span className="text-[14px] text-muted-foreground">
                      {loading ? "Loading…" : "No topics started yet."}
                    </span>
                  )}
                  {startedTopics.map((t) => {
                    const on = selected.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggle(t.id)}
                        className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-[13px] transition-colors ${
                          on
                            ? "border-forest bg-forest text-primary-foreground"
                            : "border-border text-foreground/75 hover:border-forest/50"
                        }`}
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full border ${
                            on ? "border-primary-foreground bg-primary-foreground" : "border-forest/50"
                          }`}
                        />
                        {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 flex items-center gap-5">
                {/* Permanently disabled until the Progress Check flow exists.
                    Left visible rather than deleted because the selection UI
                    above is the real design for it. */}
                <button
                  disabled
                  title="Progress Checks aren't built yet"
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-muted px-6 py-3 text-[13.5px] font-medium text-muted-foreground"
                >
                  Start Progress Check
                  <ArrowUpRight className="h-4 w-4" />
                </button>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  Coming soon
                </span>
              </div>
            </div>
          </div>
        </section>

        <Divider />

        {/* SECTION 3 — Missed questions */}
        <section>
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="font-display text-[34px] font-normal leading-[1.1] tracking-[-0.02em]">
                Worth another <em className="italic text-forest">look</em>.
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                Questions you've gotten wrong across your Progress and Growth Checks.
                No score, no pressure — just a chance to loop back over the ideas that
                didn't quite land yet.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <EmptyPanel
              title="Nothing to revisit yet"
              body="Questions you miss on a Progress or Growth Check will collect here, with the answer and why it works."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- Topic bars ---------- */

/**
 * One bar per started topic, showing how much of it is finished.
 *
 * Note the axis label says "complete", not "mastery". The old version of this
 * chart plotted a `mastery` percentage that no query could produce. This plots
 * completedCount / subtopics.length, which is a real ratio of real rows.
 */
function TopicBars({ topics }: { topics: JourneyTopic[] }) {
  const W = 460;
  const H = 340;
  const padL = 12;
  const padR = 12;
  const padT = 20;
  const padB = 64;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const gap = 18;
  const barW = (innerW - gap * (topics.length - 1)) / topics.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[520px]"
      role="img"
      aria-label="How much of each topic you've completed"
    >
      {/* baseline */}
      <line
        x1={padL}
        x2={W - padR}
        y1={padT + innerH}
        y2={padT + innerH}
        stroke="var(--border)"
        strokeWidth={1}
      />
      {topics.map((t, i) => {
        const total = t.subtopics.length;
        const percent = total === 0 ? 0 : Math.round((t.completedCount / total) * 100);
        const x = padL + i * (barW + gap);
        const h = (percent / 100) * innerH;
        const y = padT + innerH - h;
        return (
          <g key={t.id}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={barW / 2}
              ry={barW / 2}
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
              {shortLabel(t.title).line1}
            </text>
            <text
              x={x + barW / 2}
              y={padT + innerH + 34}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontFamily: "var(--font-sans)", fontSize: 10.5 }}
            >
              {shortLabel(t.title).line2}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function shortLabel(label: string): { line1: string; line2: string } {
  const words = label.split(" ");
  if (words.length <= 2) return { line1: label, line2: "" };
  const mid = Math.ceil(words.length / 2);
  return { line1: words.slice(0, mid).join(" "), line2: words.slice(mid).join(" ") };
}

/* ---------- Empty states ---------- */

/**
 * Used wherever a section has no data because the feature behind it hasn't
 * been built. Says what will appear and what has to happen first, rather than
 * showing an empty chart frame that reads as a loading bug.
 */
function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-start justify-center rounded-2xl border border-dashed border-border bg-card/40 px-8 py-10">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
        {title}
      </div>
      <p className="mt-3 max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">{body}</p>
    </div>
  );
}

/* ---------- Divider ---------- */

function Divider() {
  return <div className="my-16 h-px w-full bg-border" />;
}

export default ProgressPage;
