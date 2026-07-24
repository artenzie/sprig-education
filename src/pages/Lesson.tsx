import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Check, Leaf } from "lucide-react";
import { QuestionCard, type Question } from "../components/sprig/QuestionCard";
import { supabase } from "../lib/supabase";

// Topic I.I — The Psychology of Spending. Default until the dashboard links
// into a specific topic; override with ?topic=<id> for testing other topics.
const DEFAULT_TOPIC_ID = "b14567dc-5f0b-4dd3-9e95-9fd54ea4c949";

/* ---------- Data shapes + fetching ---------- */

type DbSlide = {
  id: string;
  order: number;
  heading: string;
  body: string;
};

type DbQuestion = {
  id: string;
  order: number | null;
  question_type: "mcq" | "multi" | "num" | "text";
  question_text: string;
  options: string[];
  correct_answer: string;
  accepted_answers: string[] | null;
  tolerance: number | null;
  explanation: string | null;
};

type DbSubtopic = {
  id: string;
  title: string;
  order: number;
  slides: DbSlide[];
  questions: DbQuestion[];
};

type DbTopic = {
  id: string;
  tier: number;
  order: number;
  title: string;
  video_url: string | null;
  subtopics: DbSubtopic[];
};

function mapQuestion(q: DbQuestion): Question {
  const explanation = q.explanation ?? "";
  if (q.question_type === "mcq") {
    return {
      question_type: "mcq",
      prompt: q.question_text,
      options: q.options,
      correctIndex: parseInt(q.correct_answer, 10),
      explanation,
    };
  }
  if (q.question_type === "multi") {
    return {
      question_type: "multi",
      prompt: q.question_text,
      options: q.options,
      correctIndices: JSON.parse(q.correct_answer),
      explanation,
    };
  }
  if (q.question_type === "num") {
    return {
      question_type: "num",
      prompt: q.question_text,
      correctValue: parseFloat(q.correct_answer),
      tolerance: q.tolerance,
      explanation,
    };
  }
  return {
    question_type: "text",
    prompt: q.question_text,
    acceptedAnswers: q.accepted_answers ?? [q.correct_answer],
    explanation,
  };
}

function normalizeTopic(raw: DbTopic): DbTopic {
  const subtopics = [...raw.subtopics]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      ...s,
      slides: [...s.slides].sort((a, b) => a.order - b.order),
      questions: [...s.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
  return { ...raw, subtopics };
}

/* ---------- Flat step model ---------- */
// The lesson is: one topic-level video, then each subtopic's slides -> a
// "ready" screen -> that subtopic's questions, one after another.

type ContentStep =
  | { kind: "video" }
  | { kind: "slide"; subtopicIndex: number; slide: DbSlide; slideIndex: number; totalSlides: number }
  | { kind: "ready"; subtopicIndex: number }
  | {
      kind: "question";
      subtopicIndex: number;
      question: Question;
      questionIndex: number;
      totalQuestions: number;
    };

function buildSteps(topic: DbTopic): ContentStep[] {
  const steps: ContentStep[] = [{ kind: "video" }];
  topic.subtopics.forEach((sub, subtopicIndex) => {
    sub.slides.forEach((slide, slideIndex) => {
      steps.push({ kind: "slide", subtopicIndex, slide, slideIndex, totalSlides: sub.slides.length });
    });
    steps.push({ kind: "ready", subtopicIndex });
    sub.questions.forEach((q, questionIndex) => {
      steps.push({
        kind: "question",
        subtopicIndex,
        question: mapQuestion(q),
        questionIndex,
        totalQuestions: sub.questions.length,
      });
    });
  });
  return steps;
}

function toRoman(num: number): string {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let result = "";
  for (const [value, symbol] of table) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result || "I";
}

function Lesson() {
  const [searchParams] = useSearchParams();
  const topicId = searchParams.get("topic") ?? DEFAULT_TOPIC_ID;
  const [topic, setTopic] = useState<DbTopic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pointer, setPointer] = useState(0);
  const [phase, setPhase] = useState<"content" | "feedback">("content");
  const [correct, setCorrect] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTopic(null);
    setLoadError(null);
    setPointer(0);
    setPhase("content");
    supabase
      .from("topics")
      .select("*, subtopics(*, slides(*), questions(*))")
      .eq("id", topicId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadError(error?.message ?? "Topic not found.");
          return;
        }
        setTopic(normalizeTopic(data as DbTopic));
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const steps = useMemo(() => (topic ? buildSteps(topic) : []), [topic]);
  const totalSteps = steps.length;
  const current = steps[pointer];
  const isDone = topic !== null && pointer >= totalSteps;

  const canPrev =
    phase === "content" && !!current && (current.kind === "slide" || current.kind === "ready") && pointer > 0;
  const canNext = phase === "content" && !!current && (current.kind === "video" || current.kind === "slide");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && canNext) setPointer((p) => Math.min(totalSteps - 1, p + 1));
      if (e.key === "ArrowLeft" && canPrev) setPointer((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPrev, canNext, totalSteps]);

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-10 text-center text-foreground">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
          Couldn't load this lesson
        </span>
        <p className="max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">{loadError}</p>
        <Link
          to="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
        >
          ← Back to Journey
        </Link>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Loading lesson…
        </span>
      </div>
    );
  }

  if (isDone) {
    return <CompletionScreen topicTitle={topic.title} />;
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <header className="relative mx-auto flex max-w-[1280px] items-center justify-between px-10 pt-8">
        <Link
          to="/dashboard"
          className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground hover:text-forest"
        >
          ← Journey
        </Link>

        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
          <SprigProgress pointer={pointer} total={totalSteps} />
        </div>

        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          {toRoman(topic.tier)} · {toRoman(topic.order)}
        </span>
      </header>

      <main className="relative mx-auto flex min-h-[calc(100vh-160px)] max-w-[1280px] items-center px-10">
        {canPrev && (
          <button
            aria-label="Previous"
            onClick={() => setPointer((p) => Math.max(0, p - 1))}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-forest"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={1.25} />
          </button>
        )}
        {canNext && (
          <button
            aria-label="Next"
            onClick={() => setPointer((p) => Math.min(totalSteps - 1, p + 1))}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-forest"
          >
            <ChevronRight className="h-8 w-8" strokeWidth={1.25} />
          </button>
        )}

        <div className="mx-auto w-full max-w-[860px] py-16">
          {phase === "content" && current.kind === "video" && (
            <VideoStep tier={topic.tier} topicOrder={topic.order} title={topic.title} />
          )}
          {phase === "content" && current.kind === "slide" && (
            <SlideStep
              slide={current.slide}
              subtopicIndex={current.subtopicIndex}
              totalSubtopics={topic.subtopics.length}
              slideIndex={current.slideIndex}
              totalSlides={current.totalSlides}
            />
          )}
          {phase === "content" && current.kind === "ready" && (
            <ReadyStep
              onBack={() => setPointer((p) => p - 1)}
              onStart={() => {
                setAttempt((a) => a + 1);
                setPointer((p) => p + 1);
              }}
            />
          )}
          {phase === "content" && current.kind === "question" && (
            <QuestionCard
              key={attempt}
              question={current.question}
              kicker={`Subtopic ${current.subtopicIndex + 1} of ${topic.subtopics.length} · Question ${
                current.questionIndex + 1
              } of ${current.totalQuestions}`}
              onSubmit={(isCorrect) => {
                setCorrect(isCorrect);
                setPhase("feedback");
              }}
            />
          )}
          {phase === "feedback" && current.kind === "question" && (
            <FeedbackStep
              correct={correct}
              explanation={current.question.explanation}
              isFinal={pointer === totalSteps - 1}
              onContinue={() => {
                setPhase("content");
                setPointer((p) => p + 1);
              }}
              onRetry={() => {
                setAttempt((a) => a + 1);
                setPhase("content");
              }}
            />
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-[1280px] px-10 pb-8">
        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>{topic.title}</span>
          <span>
            {Math.min(pointer + 1, totalSteps)} / {totalSteps}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Steps ---------- */

function VideoStep({ tier, topicOrder, title }: { tier: number; topicOrder: number; title: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-mint/40">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="currentColor" className="text-forest/15" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
        <button aria-label="Play video" className="group absolute inset-0 flex items-center justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-forest text-primary-foreground shadow-[0_16px_40px_-16px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform group-hover:scale-105">
            <Play className="ml-1 h-7 w-7 fill-current" strokeWidth={0} />
          </span>
        </button>
      </div>

      <div className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        Chapter {toRoman(tier)} · Topic {toRoman(topicOrder)}
      </div>
      <h1 className="mt-4 font-display text-[44px] font-normal leading-[1.05] tracking-[-0.03em]">{title}</h1>
      <p className="mt-4 max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">
        A short film. Watch it once, then work through four short ideas and a check-in for each.
      </p>
    </div>
  );
}

function SlideStep({
  slide,
  subtopicIndex,
  totalSubtopics,
  slideIndex,
  totalSlides,
}: {
  slide: DbSlide;
  subtopicIndex: number;
  totalSubtopics: number;
  slideIndex: number;
  totalSlides: number;
}) {
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        Part {subtopicIndex + 1} of {totalSubtopics} &nbsp;·&nbsp; Slide {slideIndex + 1} / {totalSlides}
      </div>
      <h2 className="mt-6 font-display text-[42px] font-normal leading-[1.08] tracking-[-0.03em]">
        {slide.heading}
      </h2>
      <div className="mt-8 space-y-5 text-[16px] leading-[1.75] text-foreground/85">
        <p>{slide.body}</p>
      </div>
    </div>
  );
}

function ReadyStep({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Leaf className="h-8 w-8 text-forest" strokeWidth={1.4} />
      <h2 className="mt-6 font-display text-[44px] font-normal leading-[1.05] tracking-[-0.03em]">
        Ready to test what
        <br />
        you've <em className="italic text-forest">learned</em>?
      </h2>
      <p className="mt-5 max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">
        A few quick questions. No score, no punishment — just a check that the ideas landed.
      </p>

      <div className="mt-12 flex items-center gap-8">
        <button
          onClick={onBack}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
        >
          ← Review slides again
        </button>
        <button
          onClick={onStart}
          className="rounded-full bg-terracotta px-7 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--terracotta)_60%,transparent)] transition-transform hover:-translate-y-0.5"
        >
          Start questions
        </button>
      </div>
    </div>
  );
}

function FeedbackStep({
  correct,
  explanation,
  isFinal,
  onContinue,
  onRetry,
}: {
  correct: boolean;
  explanation: string;
  isFinal: boolean;
  onContinue: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-[620px]">
      <div className="flex items-center gap-3">
        {correct ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Check className="h-4.5 w-4.5" strokeWidth={2.4} />
          </span>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
            <Leaf className="h-4.5 w-4.5" strokeWidth={1.6} />
          </span>
        )}
        <span
          className={`font-display text-[26px] italic tracking-[-0.02em] ${
            correct ? "text-forest" : "text-terracotta"
          }`}
        >
          {correct ? "Correct" : "Not quite"}
        </span>
      </div>

      <p className="mt-6 text-[16.5px] leading-[1.7] text-foreground/85">{explanation}</p>

      <div className="mt-10 h-px w-full bg-border" />

      <div className="mt-8 flex items-center justify-between">
        {!correct ? (
          <button
            onClick={onRetry}
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 hover:text-forest hover:underline"
          >
            ← Try again
          </button>
        ) : (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {isFinal ? "Lesson complete · +40 xp" : "+10 xp"}
          </span>
        )}

        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5"
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Completion celebration ---------- */

function CompletionScreen({ topicTitle }: { topicTitle: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-10 text-center text-foreground">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        {topicTitle} · Complete
      </span>

      <div className="mt-10">
        <SprigPlant stage={5} size="hero" />
      </div>

      <h1 className="mt-12 font-display text-[56px] font-normal leading-[1.05] tracking-[-0.03em]">
        Another <em className="italic text-forest">sprig</em> has grown.
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-muted-foreground">
        {topicTitle} — added to your journey. Small steps, real roots.
      </p>

      <div className="mt-14 flex items-center gap-8">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          +40 xp · Streak 13
        </span>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-forest px-8 py-3.5 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5"
        >
          Back to your journey
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

/* ---------- Growing sprig progress ---------- */

// Top-of-screen progress indicator, small.
function SprigProgress({ pointer, total }: { pointer: number; total: number }) {
  // Map progress through the whole flat step list onto the plant's 6 stages.
  const fraction = total > 0 ? pointer / total : 0;
  const stage = Math.max(0, Math.min(5, Math.floor(fraction * 6))) as 0 | 1 | 2 | 3 | 4 | 5;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <SprigPlant stage={stage} size="mini" />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {Math.min(pointer + 1, total)} / {total}
      </span>
    </div>
  );
}

/**
 * SprigPlant — a hand-drawn growing plant, visibly different at each stage.
 *
 * Stages:
 *  0 — seedling: a tiny sprout barely breaking the soil, two cotyledon nubs.
 *  1 — bare stem: a visible, short stem — no true leaves yet.
 *  2 — first leaf: taller stem, one leaf unfurled on one side.
 *  3 — two leaves: taller still, a second leaf on the opposite side.
 *  4 — three leaves: proper little plant, three leaves alternating.
 *  5 — full: four leaves, a healthy small plant. Used for correct AND
 *      incorrect feedback (mistakes don't punish growth) and, larger,
 *      on the completion screen.
 */
function SprigPlant({
  stage,
  size = "mini",
}: {
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  size?: "mini" | "hero";
}) {
  const dims =
    size === "hero"
      ? { w: 220, h: 260, sw: 2.6, leafScale: 1 }
      : { w: 96, h: 112, sw: 2.2, leafScale: 1.15 };

  // Design in a 100x120 space (x: 0..100, y: 0..120, ground line at y=110).
  // Then scale to dims.

  // Stem paths per stage — each stage has a taller, slightly more curved stem.
  const stems: Record<number, string> = {
    0: "M50 110 C 50 106, 50 104, 50 102",           // just a nub
    1: "M50 110 C 49 100, 51 92, 50 82",             // short stem
    2: "M50 110 C 49 98, 52 88, 50 74",              // taller
    3: "M50 110 C 49 96, 52 82, 50 64",              // taller still
    4: "M50 110 C 48 94, 53 76, 50 52",              // proper little plant
    5: "M50 110 C 48 92, 53 70, 50 40",              // full plant
  };

  // Leaf positions: {cx, cy, rot, side} — appear cumulatively.
  // Coordinates on the 100x120 canvas.
  const leaves = [
    { cx: 43, cy: 74, rot: -55 },  // leaf 1 (appears at stage 2)
    { cx: 57, cy: 66, rot: 55 },   // leaf 2 (appears at stage 3)
    { cx: 43, cy: 58, rot: -50 },  // leaf 3 (appears at stage 4)
    { cx: 57, cy: 48, rot: 48 },   // leaf 4 (appears at stage 5)
  ];

  // Also a small crown leaf/tip for stage 5 to make it feel "finished".
  const crown = stage >= 5;

  // Cotyledons (baby seed-leaves) only at stage 0.
  const seedling = stage === 0;

  // Soil line
  const soil = size === "hero";

  const leafRx = 6.5 * dims.leafScale;
  const leafRy = 2.6 * dims.leafScale;

  return (
    <svg
      width={dims.w}
      height={dims.h}
      viewBox="0 0 100 120"
      preserveAspectRatio="xMidYMax meet"
      aria-label={`Sprig stage ${stage + 1} of 6`}
    >
      {/* Soil hint (hero only) */}
      {soil && (
        <>
          <path
            d="M 20 111 Q 50 114 80 111"
            fill="none"
            stroke="var(--forest)"
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.35}
          />
          <circle cx="30" cy="113" r="0.9" fill="var(--forest)" opacity={0.35} />
          <circle cx="66" cy="113.5" r="0.7" fill="var(--forest)" opacity={0.3} />
        </>
      )}

      {/* Stem */}
      <path
        d={stems[stage]}
        fill="none"
        stroke="var(--forest)"
        strokeWidth={dims.sw}
        strokeLinecap="round"
        opacity={stage === 0 ? 0.85 : 0.9}
      />

      {/* Seedling cotyledons — only stage 0 */}
      {seedling && (
        <>
          <ellipse
            cx={46}
            cy={103}
            rx={3.2}
            ry={1.6}
            transform="rotate(-30 46 103)"
            fill="var(--forest)"
            opacity={0.85}
          />
          <ellipse
            cx={54}
            cy={103}
            rx={3.2}
            ry={1.6}
            transform="rotate(30 54 103)"
            fill="var(--forest)"
            opacity={0.85}
          />
        </>
      )}

      {/* True leaves, appearing cumulatively from stage 2 upward */}
      {leaves.map((l, i) => {
        const appearsAt = i + 2; // leaf 0 at stage 2, etc.
        if (stage < appearsAt) return null;
        return (
          <g key={i} transform={`rotate(${l.rot} ${l.cx} ${l.cy})`}>
            {/* leaf blade */}
            <ellipse
              cx={l.cx}
              cy={l.cy}
              rx={leafRx}
              ry={leafRy}
              fill="var(--forest)"
              opacity={0.92}
            />
            {/* leaf midrib (hero only, subtle detail) */}
            {size === "hero" && (
              <line
                x1={l.cx - leafRx + 0.6}
                y1={l.cy}
                x2={l.cx + leafRx - 0.6}
                y2={l.cy}
                stroke="var(--cream)"
                strokeWidth={0.6}
                opacity={0.55}
              />
            )}
          </g>
        );
      })}

      {/* Crown tip at full growth */}
      {crown && (
        <ellipse
          cx={50}
          cy={38}
          rx={2.4 * dims.leafScale}
          ry={4 * dims.leafScale}
          fill="var(--forest)"
          opacity={0.95}
        />
      )}
    </svg>
  );
}

export default Lesson;
