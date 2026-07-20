import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

/* ---------- Data ---------- */

const GROWTH_POINTS = [
  { week: "Baseline", date: "12 Sep", score: 34 },
  { week: "Week 2", date: "26 Sep", score: 41 },
  { week: "Week 4", date: "10 Oct", score: 52 },
  { week: "Week 6", date: "24 Oct", score: 58 },
  { week: "Week 8", date: "07 Nov", score: 67 },
  { week: "Week 10", date: "21 Nov", score: 71 },
  { week: "Week 12", date: "05 Dec", score: 78 },
];

const TOPICS = [
  { id: "psych", label: "Psychology of Spending", mastery: 82 },
  { id: "source", label: "Where Money Comes From", mastery: 74 },
  { id: "decisions", label: "Money Decisions", mastery: 68 },
  { id: "banks", label: "How Banks Work", mastery: 55 },
  { id: "goals", label: "Setting a Goal", mastery: 0, locked: true },
];

type MissedCard = {
  id: string;
  question: string;
  answer: string;
  explanation: string;
  source: "progress" | "growth";
  topic: string;
};

const MISSED: MissedCard[] = [
  {
    id: "m1",
    question:
      "If a shop marks a jumper up 20% then puts it in a '20% off' sale, what's the final price compared to the original?",
    answer: "Slightly cheaper — but not the same.",
    explanation:
      "Adding 20% then removing 20% doesn't cancel out. The second discount is taken from the higher price, so you end up paying 96% of the original.",
    source: "progress",
    topic: "Psychology of Spending",
  },
  {
    id: "m2",
    question: "When you deposit £100 into a normal bank account, where does most of it go?",
    answer: "The bank lends most of it out to other customers.",
    explanation:
      "Banks keep only a small fraction on hand. Your balance is really a promise the bank owes you — that's why interest exists.",
    source: "growth",
    topic: "How Banks Work",
  },
  {
    id: "m3",
    question: "Which of these is the clearest sign a 'free trial' is designed to catch you out?",
    answer: "It asks for card details up front and auto-renews silently.",
    explanation:
      "Legitimate trials usually make cancellation easy. Card-required trials rely on people forgetting — that's the business model, not a bug.",
    source: "progress",
    topic: "Subscriptions",
  },
  {
    id: "m4",
    question:
      "Your friend says '£10 a month is nothing.' What's the honest way to think about that claim?",
    answer: "£10/month is £120 a year, and about £1,200 over ten years.",
    explanation:
      "Small recurring costs feel invisible per month but stack up over time. The question isn't 'can I afford £10?' — it's 'is this worth £120 this year?'",
    source: "progress",
    topic: "Money Decisions",
  },
  {
    id: "m5",
    question: "Why does inflation quietly reduce the value of money left in a normal account?",
    answer: "Prices rise faster than the interest the account pays.",
    explanation:
      "If prices go up 4% and your account pays 1%, your money buys ~3% less each year even though the number on screen looks the same.",
    source: "growth",
    topic: "Inflation",
  },
];

/* ---------- Page ---------- */

function ProgressPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const completedTopics = TOPICS.filter((t) => !t.locked);

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
            <button className="inline-flex shrink-0 items-center gap-2 rounded-full bg-terracotta px-6 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--terracotta)_60%,transparent)] transition-transform hover:-translate-y-0.5">
              Take Growth Check
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-10">
            <GrowthChart points={GROWTH_POINTS} />
          </div>
        </section>

        <Divider />

        {/* SECTION 2 — Progress by topic */}
        <section>
          <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <TopicBars topics={completedTopics} />

            <div className="flex flex-col">
              <h2 className="font-display text-[34px] font-normal leading-[1.1] tracking-[-0.02em]">
                Your topics
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                A closer look at how you're doing across each subtopic you've already covered.
                Pick any combination below and take a focused Progress Check — a short test
                on just those topics.
              </p>

              <div className="mt-8">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
                  Choose what to revisit
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {completedTopics.map((t) => {
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
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 flex items-center gap-5">
                <button
                  disabled={selected.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_10px_30px_-14px_color-mix(in_oklab,var(--forest)_70%,transparent)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:hover:translate-y-0"
                >
                  Start Progress Check
                  <ArrowUpRight className="h-4 w-4" />
                </button>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  {selected.length === 0
                    ? "Pick at least one topic"
                    : `${selected.length} selected`}
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
            <Legend />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {MISSED.map((m) => (
              <MissedCardView key={m.id} card={m} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

/* ---------- Growth chart ---------- */

function GrowthChart({ points }: { points: typeof GROWTH_POINTS }) {
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

/* ---------- Topic bars ---------- */

function TopicBars({ topics }: { topics: typeof TOPICS }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[520px]" role="img" aria-label="Mastery by topic">
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
        const x = padL + i * (barW + gap);
        const h = (t.mastery / 100) * innerH;
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
              {t.mastery}%
            </text>
            {/* label */}
            <text
              x={x + barW / 2}
              y={padT + innerH + 20}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontFamily: "var(--font-sans)", fontSize: 10.5 }}
            >
              {shortLabel(t.label).line1}
            </text>
            <text
              x={x + barW / 2}
              y={padT + innerH + 34}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontFamily: "var(--font-sans)", fontSize: 10.5 }}
            >
              {shortLabel(t.label).line2}
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

/* ---------- Missed cards ---------- */

function Legend() {
  return (
    <div className="hidden shrink-0 flex-col gap-2 md:flex">
      <LegendRow color="var(--forest-soft)" label="Missed on a Progress Check" />
      <LegendRow color="var(--forest)" label="Missed on a Growth Check" />
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
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

function MissedCardView({ card }: { card: MissedCard }) {
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

/* ---------- Divider ---------- */

function Divider() {
  return <div className="my-16 h-px w-full bg-border" />;
}

export default ProgressPage;
