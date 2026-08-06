import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronRight, Leaf } from "lucide-react";
import { QuestionCard, type AnswerResult, type Question } from "@/components/sprig/QuestionCard";
import { describeCorrectAnswer, mapQuestion, type DbQuestion } from "@/lib/questions";
import { selectTestQuestions, MIN_TEST_QUESTIONS, TEST_QUESTION_COUNT } from "@/lib/testSelection";
import {
  saveTestAttempt,
  scoreAttempt,
  type AnsweredQuestion,
  type TestType,
} from "@/lib/testAttempts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";

/**
 * The baseline / Growth Check flow.
 *
 * HOW THIS DIFFERS FROM A LESSON, ON PURPOSE
 *
 * The lesson flow shows an explanation after every question and lets the
 * student retry until they get it right, because its job is teaching. This
 * flow does neither. A test that explains the answer as it goes is measuring
 * how well it just taught you, not what you knew when you walked in; and a
 * retry turns every question into "eventually correct". So questions run
 * straight through, and every explanation arrives at the end, together.
 *
 * That end-of-test review is why the flow keeps the full question objects in
 * memory rather than only the outcomes -- it can show a student exactly what
 * they missed without a second round trip.
 *
 * WHAT IS NOT HERE, KNOWINGLY: a refresh mid-test starts over. There is no
 * draft row, so an abandoned attempt leaves nothing behind. That is the honest
 * record -- a half-finished test stored with a score would appear on the growth
 * chart as a bad week -- but it does mean a student who reloads loses their
 * place, and that is a real limitation rather than a design flourish.
 */

/* ---------- Data shapes + fetching ---------- */

/**
 * A `questions` row with just enough of its ancestry to group by topic.
 *
 * PostgREST returns a many-to-one embed as a single object, so `subtopics` is
 * one subtopic and `topics` one topic -- not arrays. Both are typed nullable
 * because an embed that fails to resolve comes back null rather than throwing,
 * and a question with no reachable topic has to be dropped rather than crash
 * the selector.
 */
type PoolRow = DbQuestion & {
  subtopic_id: string;
  subtopics: {
    topic_id: string;
    topics: { id: string; title: string } | null;
  } | null;
};

/** A question as this flow carries it: gradeable, and tagged with where it came from. */
type TestQuestion = {
  id: string;
  topicId: string;
  topicTitle: string;
  subtopicId: string;
  question: Question;
};

const POOL_SELECT =
  "id, question_type, question_text, options, correct_answer, accepted_answers, tolerance, explanation, subtopic_id, subtopics(topic_id, topics(id, title))";

function toTestQuestion(row: PoolRow): TestQuestion | null {
  const topic = row.subtopics?.topics;
  if (!row.subtopics || !topic) return null;
  return {
    id: row.id,
    topicId: row.subtopics.topic_id,
    topicTitle: topic.title,
    subtopicId: row.subtopic_id,
    question: mapQuestion(row),
  };
}

/* ---------- Test type ---------- */

/**
 * An unknown or missing `?type=` falls back to a growth check rather than
 * erroring: the worst case is a student takes a slightly mislabelled test,
 * which is better than a dead end.
 *
 * `progress_check` additionally needs a `?topics=` param (comma-separated
 * topic ids) -- see the pool-filtering step in the data-fetching effect below.
 */
function readTestType(raw: string | null): TestType {
  if (raw === "baseline") return "baseline";
  if (raw === "progress_check") return "progress_check";
  return "growth_check";
}

/** Parses `?topics=id1,id2` into a set. Empty/missing param yields an empty set. */
function readSelectedTopicIds(raw: string | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

const TEST_LABEL: Record<TestType, string> = {
  baseline: "Baseline",
  growth_check: "Growth Check",
  progress_check: "Progress Check",
};

/* ---------- Page ---------- */

type Phase = "intro" | "questions" | "saving" | "results";

function TestFlow() {
  const [searchParams] = useSearchParams();
  const testType = readTestType(searchParams.get("type"));
  const selectedTopicIds = readSelectedTopicIds(searchParams.get("topics"));
  const { student } = useAuth();

  const [questions, setQuestions] = useState<TestQuestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Same cancellation guard as Lesson.tsx and useJourney.ts: React 19
    // StrictMode double-mounts in development, and a student can navigate away
    // mid-flight.
    let cancelled = false;

    // A Progress Check with nothing selected is a routing error (stale
    // bookmark, hand-edited URL) -- the "Start" button on /progress is
    // disabled until at least one topic is picked, so this isn't reachable
    // through normal use. Caught here rather than falling through to the
    // generic small-pool message below, which would read as a bank problem.
    if (testType === "progress_check" && selectedTopicIds.size === 0) {
      setLoadError("Pick at least one topic on your progress page, then start again.");
      return;
    }

    Promise.all([
      supabase.from("questions").select(POOL_SELECT),
      // Only a Progress Check needs to know which subtopics are done; the
      // other two test types sample the whole bank regardless of progress.
      testType === "progress_check"
        ? supabase.from("progress").select("subtopic_id").eq("status", "complete")
        : Promise.resolve({ data: [] as { subtopic_id: string }[], error: null }),
    ]).then(([poolResult, progressResult]) => {
      if (cancelled) return;
      if (poolResult.error) {
        setLoadError(poolResult.error.message);
        return;
      }
      if (progressResult.error) {
        setLoadError(progressResult.error.message);
        return;
      }

      let pool = ((poolResult.data ?? []) as unknown as PoolRow[])
        .map(toTestQuestion)
        .filter((q): q is TestQuestion => q !== null);

      if (testType === "progress_check") {
        const completedSubtopicIds = new Set(
          (progressResult.data ?? []).map((r) => r.subtopic_id),
        );
        pool = pool.filter(
          (q) => selectedTopicIds.has(q.topicId) && completedSubtopicIds.has(q.subtopicId),
        );
      }

      if (pool.length < MIN_TEST_QUESTIONS) {
        setLoadError(
          testType === "progress_check"
            ? "There aren't enough questions yet in the topics you picked. Try selecting one or two more topics you've finished, or finish more of the ones you chose."
            : "There isn't enough content in the question bank yet to build a test.",
        );
        return;
      }

      setQuestions(selectTestQuestions(pool, TEST_QUESTION_COUNT));
    });

    return () => {
      cancelled = true;
    };
    // The pool (and, for a Progress Check, the topic selection) is fixed for
    // the life of this page, so this runs once. Re-selecting on every render
    // would reshuffle the test underneath the student.
  }, []);

  const total = questions?.length ?? 0;
  const current = questions?.[index] ?? null;

  /**
   * Record one answer and move on -- or, on the last question, save.
   *
   * The save deliberately happens here rather than in an effect watching the
   * answer count. An effect would fire twice under StrictMode and write two
   * attempt rows for one test; an event handler runs exactly once per click.
   */
  async function handleAnswer(result: AnswerResult) {
    if (!current || !questions) return;

    const answered: AnsweredQuestion = {
      questionId: current.id,
      topicId: current.topicId,
      subtopicId: current.subtopicId,
      outcome: result.outcome,
      response: result.response,
    };
    const nextAnswers = [...answers, answered];
    setAnswers(nextAnswers);

    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
      return;
    }

    setPhase("saving");
    if (!student) {
      // RequireAuth makes this unreachable in practice; handled rather than
      // asserted so a signed-out edge case shows the score instead of crashing.
      setSaveError("You appear to be signed out, so this attempt wasn't saved.");
      setPhase("results");
      return;
    }

    const saved = await saveTestAttempt(student.id, testType, nextAnswers);
    if (!saved.ok) setSaveError(saved.message);
    setPhase("results");
  }

  if (loadError) {
    return (
      <CentredNotice
        kicker="Couldn't start this test"
        body={loadError}
        to="/progress"
        label="← Back to progress"
      />
    );
  }

  if (!questions) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Building your test…
        </span>
      </div>
    );
  }

  if (phase === "intro") {
    return <IntroScreen testType={testType} total={total} onStart={() => setPhase("questions")} />;
  }

  if (phase === "saving") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Saving your result…
        </span>
      </div>
    );
  }

  if (phase === "results") {
    return (
      <ResultsScreen
        testType={testType}
        questions={questions}
        answers={answers}
        saveError={saveError}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-10 pt-8">
        <Link
          to="/progress"
          className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-forest"
        >
          ← Leave test
        </Link>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          {TEST_LABEL[testType]}
        </span>
      </header>

      {/* A plain bar rather than the lesson's growing sprig. The plant is the
          reward metaphor for learning; a test is a measurement, and dressing it
          up as growth would imply the score itself makes you grow. */}
      <div className="mx-auto mt-6 max-w-[860px] px-10">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <main className="mx-auto flex min-h-[calc(100vh-200px)] max-w-[1280px] items-center px-10">
        <div className="mx-auto w-full max-w-[760px] py-12">
          {current && (
            <QuestionCard
              // Remounts between questions. QuestionCard keeps the current
              // selection in local state, so without a changing key the
              // student's pick would carry over onto the next question.
              key={current.id}
              question={current.question}
              kicker={`Question ${index + 1} of ${total}`}
              allowUnsure
              submitLabel={index + 1 === total ? "Finish test" : "Next question"}
              onSubmit={(result) => void handleAnswer(result)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- Intro ---------- */

/**
 * Not decoration. The honesty incentive behind "I'm not sure yet" only works
 * if the student knows before they start that skipping is allowed and that
 * guessing isn't wanted -- otherwise they do what every test has trained them
 * to do, and guess.
 */
function IntroScreen({
  testType,
  total,
  onStart,
}: {
  testType: TestType;
  total: number;
  onStart: () => void;
}) {
  const isBaseline = testType === "baseline";
  const isProgressCheck = testType === "progress_check";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-10 text-center text-foreground">
      <Leaf className="h-8 w-8 text-forest" strokeWidth={1.4} />

      <div className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        {TEST_LABEL[testType]} · {total} questions
      </div>

      <h1 className="mt-5 max-w-2xl font-display text-[52px] font-normal leading-[1.05] tracking-[-0.03em]">
        {isBaseline ? (
          <>
            Let's find your <em className="italic text-forest">starting point</em>.
          </>
        ) : isProgressCheck ? (
          <>
            See where you stand on what you've <em className="italic text-forest">already finished</em>.
          </>
        ) : (
          <>
            See how far you've <em className="italic text-forest">grown</em>.
          </>
        )}
      </h1>

      <p className="mt-6 max-w-lg text-[15.5px] leading-[1.75] text-muted-foreground">
        {isBaseline
          ? "A mix of questions from across everything Sprig covers — including plenty you haven't been taught yet. That's the point: it marks where you're starting from, so you can see how far you move."
          : isProgressCheck
            ? "Only questions from the topics you picked, and only what you've already completed. Nothing you haven't been taught yet — this checks retention, not readiness."
            : "A mix of questions from across everything Sprig covers, so you can compare this with your baseline and every check since."}
      </p>

      <div className="mt-10 max-w-md rounded-2xl border border-border bg-card/40 px-7 py-6 text-left">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-forest">
          If you don't know, say so
        </div>
        <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
          Every question has an <span className="text-foreground/80">"I'm not sure yet"</span>{" "}
          option. It's never counted as a wrong answer — and it's far more useful than a guess,
          because it tells us what to teach you next. No feedback until the end, so answer as
          honestly as you can.
        </p>
      </div>

      <button
        onClick={onStart}
        className="mt-12 inline-flex items-center gap-2 rounded-full bg-forest px-8 py-3.5 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5"
      >
        Start
        <ChevronRight className="h-4 w-4" />
      </button>

      <Link
        to="/progress"
        className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
      >
        Not right now
      </Link>
    </div>
  );
}

/* ---------- Results ---------- */

function ResultsScreen({
  testType,
  questions,
  answers,
  saveError,
}: {
  testType: TestType;
  questions: TestQuestion[];
  answers: AnsweredQuestion[];
  saveError: string | null;
}) {
  const score = scoreAttempt(answers);
  const byId = new Map(questions.map((q) => [q.id, q]));

  // Everything that isn't already known. Wrong answers and unsures are shown
  // together because they mean the same thing pedagogically -- an idea that
  // hasn't landed -- while still being labelled differently, so a student who
  // was honest never sees their honesty rendered as a mistake.
  const toRevisit = answers.filter((a) => a.outcome !== "correct");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[860px] px-10 pb-32 pt-20">
        <div className="text-center">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
            {TEST_LABEL[testType]} · Complete
          </div>

          <div className="mt-10 font-display text-[88px] font-normal leading-none tracking-[-0.04em] text-forest">
            {score.score}%
          </div>
          <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
            {score.correct} of {score.total} correct
            {testType === "baseline"
              ? " — this is your starting point, not a grade. It's meant to be low."
              : "."}
          </p>

          {/* Three counts, never two. An unsure is a distinct state and is
              never folded into "wrong". */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Tally label="Correct" value={score.correct} tone="forest" />
            <Tally label="Not quite" value={score.incorrect} tone="terracotta" />
            <Tally label="Not sure yet" value={score.unsure} tone="muted" />
          </div>
        </div>

        {saveError && (
          <p
            className="mx-auto mt-10 max-w-md text-center text-[13.5px] leading-[1.6] text-terracotta"
            role="alert"
          >
            We couldn't save this result just now, so it may not appear on your progress page.
            Your answers below are still correct — check your connection and try again later.
          </p>
        )}

        {toRevisit.length > 0 && (
          <section className="mt-20">
            <h2 className="font-display text-[32px] font-normal leading-[1.1] tracking-[-0.02em]">
              Worth another <em className="italic text-forest">look</em>.
            </h2>
            <p className="mt-3 text-[14.5px] leading-[1.7] text-muted-foreground">
              No score attached to these — just the ideas that haven't quite landed yet.
            </p>

            <div className="mt-10 space-y-5">
              {toRevisit.map((answer) => {
                const q = byId.get(answer.questionId);
                if (!q) return null;
                return (
                  <ReviewCard
                    key={answer.questionId}
                    topicTitle={q.topicTitle}
                    question={q.question}
                    wasUnsure={answer.outcome === "unsure"}
                  />
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-20 flex flex-wrap items-center justify-center gap-8">
          <Link
            to="/progress"
            className="inline-flex items-center gap-2 rounded-full bg-forest px-8 py-3.5 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5"
          >
            See your progress
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            to="/dashboard"
            className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
          >
            Back to your journey
          </Link>
        </div>
      </main>
    </div>
  );
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "forest" | "terracotta" | "muted";
}) {
  const toneClasses =
    tone === "forest"
      ? "border-forest/30 text-forest"
      : tone === "terracotta"
        ? "border-terracotta/30 text-terracotta"
        : "border-border text-muted-foreground";

  return (
    <div className={`rounded-full border px-5 py-2.5 ${toneClasses}`}>
      <span className="font-display text-[18px] leading-none">{value}</span>
      <span className="ml-2.5 font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

function ReviewCard({
  topicTitle,
  question,
  wasUnsure,
}: {
  topicTitle: string;
  question: Question;
  wasUnsure: boolean;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {topicTitle}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] ${
            wasUnsure
              ? "bg-muted text-muted-foreground"
              : "bg-terracotta/10 text-terracotta"
          }`}
        >
          {wasUnsure ? "Not met yet" : "Not quite"}
        </span>
      </div>

      <h3 className="mt-4 font-display text-[20px] font-normal leading-[1.3] tracking-[-0.01em]">
        {question.prompt}
      </h3>

      <div className="mt-5 border-t border-border pt-4">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-forest">
          Correct answer
        </div>
        <p className="mt-2 text-[14px] leading-[1.6] text-foreground/90">
          {describeCorrectAnswer(question)}
        </p>
        {question.explanation && (
          <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
            {question.explanation}
          </p>
        )}
      </div>
    </article>
  );
}

/* ---------- Shared ---------- */

function CentredNotice({
  kicker,
  body,
  to,
  label,
}: {
  kicker: string;
  body: string;
  to: string;
  label: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-10 text-center text-foreground">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
        {kicker}
      </span>
      <p className="max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">{body}</p>
      <Link
        to={to}
        className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
      >
        {label}
      </Link>
    </div>
  );
}

export default TestFlow;
