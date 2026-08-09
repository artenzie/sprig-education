import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { GrowthChart, type GrowthPoint } from "@/components/sprig/GrowthChart";
import { TopicBars } from "@/components/sprig/TopicBars";
import { Legend, MissedCardView, type MissedCard } from "@/components/sprig/growth-check-parked";
import { useJourney } from "@/hooks/useJourney";
import { useAuth } from "@/context/auth";
import { fetchTestAttempts, type TestAttemptRow } from "@/lib/testAttempts";
import { latestOutcomes, missedQuestionIds, topicMastery } from "@/lib/testMastery";
import { describeCorrectAnswer, fetchQuestionsByIds, mapQuestion, type DbQuestion } from "@/lib/questions";

/**
 * WHAT THIS PAGE SHOWS AND WHERE EACH NUMBER COMES FROM
 *
 * This page used to run entirely on invented data: seven weekly Growth Check
 * scores, five per-topic "mastery" percentages, and five missed questions with
 * written explanations. All of it is real now, and the three sections below
 * deliberately draw on two different tables that mean different things.
 *
 * `progress` records THAT a subtopic was finished -- one row, no score. The
 * "Progress by topic" bars plot that: completion, not performance. The
 * temptation was always to relabel completion as "mastery" and keep the bars
 * looking full, which would have made the page look finished while showing a
 * number that does not mean what it says.
 *
 * Real mastery -- and the missed-questions review -- come from `test_attempts`
 * instead, via src/lib/testMastery.ts. Its `answers` and `questions_shown`
 * columns hold a per-question outcome and topic id for every baseline,
 * Progress Check and Growth Check a student has taken; `latestOutcomes()`
 * collapses that into "as of their most recent attempt at each question,"
 * so a topic they've since drilled and improved doesn't stay dragged down by
 * an old bad attempt. The missed-question cards reuse the UI parked in
 * growth-check-parked.tsx and the same mapQuestion()/describeCorrectAnswer()
 * TestFlow.tsx's results screen already uses -- rebuilding a question from
 * weeks ago is the same join, just done later and from an id instead of
 * from memory.
 */

/* ---------- Page ---------- */

/**
 * Turn stored attempts into chart points.
 *
 * Only baselines and Growth Checks are plotted. Progress Checks are
 * deliberately excluded: they cover a handful of self-chosen topics, so their
 * score is not comparable with a test that samples the whole curriculum, and
 * putting both on one line would make an easy Progress Check look like growth.
 *
 * The `week` label doubles as the React key, so it is derived from the index
 * rather than the test type -- two baselines would otherwise collide.
 */
function toGrowthPoints(attempts: TestAttemptRow[]): GrowthPoint[] {
  return attempts
    .filter((a) => a.test_type === "baseline" || a.test_type === "growth_check")
    .map((attempt, i) => ({
      week: i === 0 && attempt.test_type === "baseline" ? "Baseline" : `Check ${i}`,
      date: new Date(attempt.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
      score: attempt.score,
    }));
}

function ProgressPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const { journey, loading } = useJourney();
  const { student } = useAuth();

  // null means "not loaded yet" -- distinct from [], which means "loaded, and
  // this student has genuinely never taken a test". The button label depends
  // on which of those it is, so they cannot share a value.
  const [attempts, setAttempts] = useState<TestAttemptRow[] | null>(null);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!student) return;

    void fetchTestAttempts().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setAttempts(result.attempts);
      } else {
        // Shown, not swallowed. A failed read that falls through to "no Growth
        // Checks yet" would tell a student who has taken three that they have
        // taken none -- the exact class of quiet lie the rest of this page was
        // rewritten to avoid.
        setAttemptsError(result.message);
        setAttempts([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [student]);

  const growthPoints = attempts ? toGrowthPoints(attempts) : [];
  const attemptsLoaded = attempts !== null;
  // The first test anyone ever takes is their baseline. After that they are
  // Growth Checks -- which is what finally gives the `baseline` value in the
  // test_type check constraint a writer.
  const isFirstTest = attemptsLoaded && attempts.length === 0;

  // "As of your most recent attempt at each question." See testMastery.ts for
  // why latest-wins rather than a lifetime average.
  const latest = useMemo(() => latestOutcomes(attempts ?? []), [attempts]);
  const masteryItems = useMemo(() => topicMastery(latest, journey.topics), [latest, journey.topics]);
  const topicTitleById = useMemo(
    () => new Map(journey.topics.map((t) => [t.id, t.title])),
    [journey.topics],
  );

  // Joined into one string so the effect below re-fetches only when the
  // *set* of missed ids actually changes, not on every render -- a fresh
  // array from missedQuestionIds() would otherwise have a new identity each
  // time even when its contents are unchanged.
  const missedIdsKey = useMemo(() => [...missedQuestionIds(latest)].sort().join(","), [latest]);

  // null means "not loaded yet", same convention as `attempts` above.
  const [missedRows, setMissedRows] = useState<DbQuestion[] | null>(null);
  const [missedError, setMissedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (missedIdsKey === "") {
      setMissedRows([]);
      return;
    }

    void fetchQuestionsByIds(missedIdsKey.split(",")).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setMissedRows(result.questions);
      } else {
        setMissedError(result.message);
        setMissedRows([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [missedIdsKey]);

  const missedCards: MissedCard[] = missedRows
    ? missedRows
        .map((row) => {
          const entry = latest.get(row.id);
          const question = mapQuestion(row);
          return {
            id: row.id,
            question: question.prompt,
            answer: describeCorrectAnswer(question),
            explanation: question.explanation,
            source: entry?.testType === "progress_check" ? ("progress" as const) : ("growth" as const),
            topic: (entry && topicTitleById.get(entry.topicId)) ?? "—",
          };
        })
        .sort((a, b) => a.topic.localeCompare(b.topic) || a.question.localeCompare(b.question))
    : [];

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
            {attemptsLoaded ? (
              <Link
                to={`/test?type=${isFirstTest ? "baseline" : "growth_check"}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-forest px-6 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5"
              >
                {isFirstTest ? "Take your baseline" : "Take Growth Check"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-6 py-3 text-[13.5px] font-medium text-muted-foreground">
                Loading…
              </span>
            )}
          </div>

          <div className="mt-10">
            {attemptsError ? (
              <EmptyPanel
                title="Couldn't load your results"
                body={`Your Growth Checks are safe — we just couldn't fetch them just now. ${attemptsError}`}
              />
            ) : growthPoints.length > 0 ? (
              <GrowthChart points={growthPoints} />
            ) : (
              <EmptyPanel
                title={attemptsLoaded ? "No Growth Checks yet" : "Loading…"}
                body="Start with a baseline — a short mix of questions from across the whole course. It's meant to be hard, and it's what everything after gets measured against."
              />
            )}
          </div>
        </section>

        <Divider />

        {/* SECTION 2 — Progress by topic */}
        <section>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {startedTopics.length > 0 ? (
              <TopicBars
                items={startedTopics.map((t) => ({
                  id: t.id,
                  title: t.title,
                  percent:
                    t.subtopics.length === 0
                      ? 0
                      : Math.round((t.completedCount / t.subtopics.length) * 100),
                }))}
                ariaLabel="How much of each topic you've completed"
              />
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
                {selected.length > 0 ? (
                  <Link
                    to={`/test?${new URLSearchParams({ type: "progress_check", topics: selected.join(",") })}`}
                    className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5"
                  >
                    Start Progress Check
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    disabled
                    title="Pick at least one topic above to start"
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-muted px-6 py-3 text-[13.5px] font-medium text-muted-foreground"
                  >
                    Start Progress Check
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <Divider />

        {/* SECTION 3 — Test performance: mastery bars, then missed questions */}
        <section>
          <div className="flex items-end justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="font-display text-[34px] font-normal leading-[1.1] tracking-[-0.02em]">
                Where you <em className="italic text-forest">stand</em>.
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                How you've actually done on tests, topic by topic — based on your most
                recent attempt at each question, so retaking a Progress Check moves
                these numbers.
              </p>
            </div>
          </div>

          <div className="mt-10">
            {!attemptsLoaded ? (
              <EmptyPanel title="Loading…" body="Fetching your test results." />
            ) : masteryItems.length > 0 ? (
              <TopicBars items={masteryItems} ariaLabel="Your mastery by topic" />
            ) : (
              <EmptyPanel
                title="No tests taken yet"
                body="Take a baseline or a Progress Check and this fills in with how you did, topic by topic."
              />
            )}
          </div>

          <div className="mt-16 flex items-end justify-between gap-8">
            <div className="max-w-xl">
              <h3 className="font-display text-[26px] font-normal leading-[1.15] tracking-[-0.01em]">
                Worth another <em className="italic text-forest">look</em>.
              </h3>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                Questions you're currently getting wrong or marking unsure. No score,
                no pressure — get one right on a later attempt and it drops off this
                list.
              </p>
            </div>
            {missedCards.length > 0 && <Legend />}
          </div>

          <div className="mt-10">
            {missedError ? (
              <EmptyPanel
                title="Couldn't load these"
                body={`Your results are safe — we just couldn't fetch the questions just now. ${missedError}`}
              />
            ) : missedRows === null ? (
              <EmptyPanel title="Loading…" body="Fetching your missed questions." />
            ) : missedCards.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {missedCards.map((card) => (
                  <MissedCardView key={card.id} card={card} />
                ))}
              </div>
            ) : attemptsLoaded && attempts.length > 0 ? (
              <EmptyPanel
                title="Nothing to revisit"
                body="Every question you've been tested on, you're currently getting right."
              />
            ) : (
              <EmptyPanel
                title="Nothing to revisit yet"
                body="Questions you miss on a Progress or Growth Check will collect here, with the answer and why it works."
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
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
