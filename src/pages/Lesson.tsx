import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Check, Leaf } from "lucide-react";

const TOTAL_STEPS = 6; // video, slide, slide, ready, question, feedback

const SLIDES = [
  {
    kicker: "Idea 01",
    heading: "Banks don't just store your money.",
    body: [
      "When you deposit £100, the bank doesn't lock it in a vault with your name on it. Most of it is lent out to other people — for mortgages, cars, small businesses.",
      "Your account balance is really a promise: the bank owes you that amount, on demand.",
    ],
  },
  {
    kicker: "Idea 02",
    heading: "That's why interest exists.",
    body: [
      "The bank earns more from lending your money than it pays you for keeping it there. The difference is how it makes a profit.",
      "It's also why savings accounts pay more when interest rates rise — the bank is earning more elsewhere, and passes a little of that on.",
    ],
  },
];

const QUESTION = {
  prompt: "When you deposit money into a normal bank account, what mostly happens to it?",
  options: [
    "It sits untouched in a vault with your name on it.",
    "The bank lends most of it out to other customers.",
    "It's converted into gold and stored by the government.",
    "It's invested in the stock market on your behalf.",
  ],
  correctIndex: 1,
  explainCorrect:
    "Right — banks keep only a small fraction on hand and lend the rest out. Your balance is a promise the bank owes you.",
  explainWrong:
    "Not quite — banks lend most deposits out to other customers. Only a small fraction is kept on hand for withdrawals.",
};

function Lesson() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const isCompletion = step === 6;
  const canPrev = step > 0 && step < 4;
  const canNext = step < 3;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && step < 3) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0 && step < 4) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (isCompletion) {
    return <CompletionScreen />;
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
          <SprigProgress step={step} />
        </div>

        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          I · IV
        </span>
      </header>


      <main className="relative mx-auto flex min-h-[calc(100vh-160px)] max-w-[1280px] items-center px-10">
        {canPrev && (
          <button
            aria-label="Previous"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-forest"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={1.25} />
          </button>
        )}
        {canNext && (
          <button
            aria-label="Next"
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-forest"
          >
            <ChevronRight className="h-8 w-8" strokeWidth={1.25} />
          </button>
        )}

        <div className="mx-auto w-full max-w-[860px] py-16">
          {step === 0 && <VideoStep />}
          {step === 1 && <SlideStep slide={SLIDES[0]} index={1} />}
          {step === 2 && <SlideStep slide={SLIDES[1]} index={2} />}
          {step === 3 && (
            <ReadyStep
              onBack={() => setStep(2)}
              onStart={() => {
                setSelected(null);
                setStep(4);
              }}
            />
          )}
          {step === 4 && (
            <QuestionStep
              selected={selected}
              onSelect={setSelected}
              onSubmit={() => setStep(5)}
            />
          )}
          {step === 5 && (
            <FeedbackStep
              correct={selected === QUESTION.correctIndex}
              onContinue={() => setStep(6)}
              onRetry={() => {
                setSelected(null);
                setStep(4);
              }}
            />
          )}
        </div>
      </main>

      <footer className="mx-auto max-w-[1280px] px-10 pb-8">
        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>How banks and money actually work</span>
          <span>
            {Math.min(step + 1, TOTAL_STEPS)} / {TOTAL_STEPS}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Steps ---------- */

function VideoStep() {
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
        Chapter I · Lesson IV
      </div>
      <h1 className="mt-4 font-display text-[44px] font-normal leading-[1.05] tracking-[-0.03em]">
        How banks and money <em className="italic text-forest">actually</em> work
      </h1>
      <p className="mt-4 max-w-md text-[14.5px] leading-[1.7] text-muted-foreground">
        A four-minute film. Watch it once, then move through two short ideas and a check-in.
      </p>
    </div>
  );
}

function SlideStep({ slide, index }: { slide: (typeof SLIDES)[number]; index: number }) {
  return (
    <div className="mx-auto max-w-[640px]">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        {slide.kicker} &nbsp;·&nbsp; {index} / {SLIDES.length}
      </div>
      <h2 className="mt-6 font-display text-[42px] font-normal leading-[1.08] tracking-[-0.03em]">
        {slide.heading}
      </h2>
      <div className="mt-8 space-y-5 text-[16px] leading-[1.75] text-foreground/85">
        {slide.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
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
        One quick question. No score, no punishment — just a check that the idea landed.
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
          Start question
        </button>
      </div>
    </div>
  );
}

function QuestionStep({
  selected,
  onSelect,
  onSubmit,
}: {
  selected: number | null;
  onSelect: (i: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        Check-in · Question 1 of 1
      </div>
      <h2 className="mt-5 font-display text-[32px] font-normal leading-[1.2] tracking-[-0.02em]">
        {QUESTION.prompt}
      </h2>

      <div className="mt-10 space-y-3">
        {QUESTION.options.map((opt, i) => {
          const isSel = selected === i;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`group flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
                isSel ? "border-forest bg-forest/[0.06]" : "border-border hover:border-forest/40"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  isSel ? "border-forest bg-forest text-primary-foreground" : "border-border text-muted-foreground"
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-[15px] leading-[1.55] text-foreground/90">{opt}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex justify-end">
        <button
          disabled={selected === null}
          onClick={onSubmit}
          className="rounded-full bg-terracotta px-7 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--terracotta)_60%,transparent)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0"
        >
          Submit answer
        </button>
      </div>
    </div>
  );
}

function FeedbackStep({
  correct,
  onContinue,
  onRetry,
}: {
  correct: boolean;
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

      <p className="mt-6 text-[16.5px] leading-[1.7] text-foreground/85">
        {correct ? QUESTION.explainCorrect : QUESTION.explainWrong}
      </p>

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
            Lesson complete · +40 xp
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

function CompletionScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-10 text-center text-foreground">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        Chapter I · Lesson IV · Complete
      </span>

      <div className="mt-10">
        <SprigPlant stage={5} size="hero" />
      </div>

      <h1 className="mt-12 font-display text-[56px] font-normal leading-[1.05] tracking-[-0.03em]">
        Another <em className="italic text-forest">sprig</em> has grown.
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-[1.7] text-muted-foreground">
        How banks and money actually work — added to your journey. Small steps, real roots.
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
function SprigProgress({ step }: { step: number }) {
  // Clamp step 0..5 into the plant stages 0..5.
  const stage = Math.max(0, Math.min(5, step)) as 0 | 1 | 2 | 3 | 4 | 5;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <SprigPlant stage={stage} size="mini" />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {stage + 1} / {TOTAL_STEPS}
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
