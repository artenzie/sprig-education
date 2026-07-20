import { Link } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, Play, Lock, ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

/* ---------- Icons ---------- */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function BookIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 4.5C4 4.22 4.22 4 4.5 4H11v15H4.5a.5.5 0 0 1-.5-.5v-14Z" />
      <path d="M20 4.5a.5.5 0 0 0-.5-.5H13v15h6.5a.5.5 0 0 0 .5-.5v-14Z" />
      <path d="M11 4v15M7 7.5h1.5M7 10.5h1.5M15.5 7.5H17M15.5 10.5H17" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M3.5 7.5C3.5 6.4 4.4 5.5 5.5 5.5h12A2 2 0 0 1 19.5 7.5v9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-9Z" />
      <path d="M15.5 12.5h4v-3h-4a1.5 1.5 0 0 0 0 3Z" />
      <path d="M3.5 8.5c0-1.66 1.34-3 3-3h9" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <rect x="7.5" y="6" width="9" height="3" rx="0.6" />
      <path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg {...iconProps} aria-hidden>
      <path d="M4 8.5 7.5 13 12 6.5 16.5 13 20 8.5l-1.4 9.5a1 1 0 0 1-1 .85H6.4a1 1 0 0 1-1-.85L4 8.5Z" />
      <path d="M5.5 15.5h13" />
    </svg>
  );
}

/* ---------- Data ---------- */

type Sub = { title: string; unlocked: boolean };
type Tier = {
  id: string;
  roman: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  subs: Sub[];
};

const TIERS: Tier[] = [
  {
    id: "essentials",
    roman: "I",
    name: "Essentials",
    tagline: "The trunk — money as it really is",
    icon: <BookIcon />,
    subs: [
      { title: "The Psychology of Spending", unlocked: true },
      { title: "Where Money Really Comes From", unlocked: true },
      { title: "Making Money Decisions With What You Have", unlocked: true },
      { title: "How Banks and Money Actually Work", unlocked: true },
      { title: "Setting a Goal That Actually Matters to You", unlocked: false },
    ],
  },
  {
    id: "application",
    roman: "II",
    name: "Application",
    tagline: "Money in the wild",
    icon: <WalletIcon />,
    subs: [
      { title: "Budgeting Basics", unlocked: false },
      { title: "How Pricing Tricks You", unlocked: false },
      { title: "Subscriptions & Recurring Costs", unlocked: false },
      { title: "Buy Now Pay Later", unlocked: false },
      { title: "Scams & Financial Safety", unlocked: false },
    ],
  },
  {
    id: "mathematics",
    roman: "III",
    name: "Mathematics",
    tagline: "The numbers underneath",
    icon: <CalculatorIcon />,
    subs: [
      { title: "Percentages in Real Life", unlocked: false },
      { title: "Simple Interest", unlocked: false },
      { title: "Compound Interest Intuitively", unlocked: false },
      { title: "Inflation Basics", unlocked: false },
      { title: "Why Some Choices Are Riskier Than Others", unlocked: false },
    ],
  },
  {
    id: "mastery",
    roman: "IV",
    name: "Mastery",
    tagline: "Building your own tools",
    icon: <CrownIcon />,
    subs: [
      { title: "Budget Calculator (Python)", unlocked: false },
      { title: "The Real Compound Interest Formula", unlocked: false },
      { title: "Present & Future Value", unlocked: false },
      { title: "Behavioural Finance", unlocked: false },
      { title: "Introduction to Crypto", unlocked: false },
    ],
  },
];

const VIDEOS = TIERS.flatMap((t) =>
  t.subs.map((s, i) => ({
    id: `${t.id}-${i}`,
    title: s.title,
    tier: t.name,
    roman: t.roman,
    unlocked: s.unlocked,
    length: ["6m", "8m", "9m", "7m", "10m"][i],
  })),
);

type TabId = "essentials" | "application" | "mathematics" | "mastery" | "videos";

/* ---------- Page ---------- */

function Library() {
  const [tab, setTab] = useState<TabId>("essentials");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-[1080px] px-8 pb-24 pt-10">
        <header className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            The Library
          </p>
          <h1 className="mt-2 font-display text-[42px] leading-[1.05] tracking-tight text-ink">
            Every lesson, in a straight line.
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
            The same topics as your journey — just easier to scan. Unlocked
            lessons open straight into the video; locked ones are still visible
            so you can see what's coming.
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-10 flex flex-wrap items-center gap-1 border-b border-border/70">
          <TabButton active={tab === "essentials"} onClick={() => setTab("essentials")} label="Essentials" />
          <TabButton active={tab === "application"} onClick={() => setTab("application")} label="Application" />
          <TabButton active={tab === "mathematics"} onClick={() => setTab("mathematics")} label="Mathematics" />
          <TabButton active={tab === "mastery"} onClick={() => setTab("mastery")} label="Mastery" />
          <span className="mx-2 h-4 w-px bg-border/70" />
          <TabButton active={tab === "videos"} onClick={() => setTab("videos")} label="Videos" />
        </div>

        {tab === "videos" ? (
          <VideosList />
        ) : (
          <TierList tier={TIERS.find((t) => t.id === tab)!} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px px-3 py-2.5 text-[13.5px] transition-colors ${
        active
          ? "text-forest"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-[1.5px] bg-forest" />
      )}
    </button>
  );
}

/* ---------- Tier View ---------- */

function TierList({ tier }: { tier: Tier }) {
  const [open, setOpen] = useState(true);
  const unlockedCount = tier.subs.filter((s) => s.unlocked).length;

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 border-b border-border/70 py-5 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-forest">
          {tier.icon}
        </span>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Tier {tier.roman}
            </span>
            <h2 className="font-display text-[24px] tracking-tight text-ink">
              {tier.name}
            </h2>
          </div>
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">
            {tier.tagline} · {unlockedCount}/{tier.subs.length} unlocked
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ol className="mt-2">
          {tier.subs.map((sub, i) => (
            <SubRow key={i} index={i + 1} sub={sub} roman={tier.roman} />
          ))}
        </ol>
      )}
    </section>
  );
}

function SubRow({
  index,
  sub,
  roman,
}: {
  index: number;
  sub: Sub;
  roman: string;
}) {
  const label = (
    <>
      <span className="w-14 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {roman}.{index}
      </span>
      <span
        className={`flex-1 text-[15.5px] ${
          sub.unlocked ? "text-ink" : "text-muted-foreground/60"
        }`}
      >
        {sub.title}
      </span>
    </>
  );

  if (!sub.unlocked) {
    return (
      <li className="flex cursor-not-allowed items-center gap-4 border-b border-border/50 py-4 opacity-70">
        {label}
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
          <Lock className="h-3.5 w-3.5" />
          Locked
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        to="/lesson"
        className="group flex items-center gap-4 border-b border-border/60 py-4 transition-colors hover:bg-forest/5"
      >
        {label}
        <span className="inline-flex items-center gap-1 text-[12.5px] text-forest opacity-0 transition-opacity group-hover:opacity-100">
          Open
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </li>
  );
}

/* ---------- Videos View ---------- */

function VideosList() {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-[22px] tracking-tight text-ink">
          All videos
        </h2>
        <span className="text-[12.5px] text-muted-foreground">
          {VIDEOS.length} in total · {VIDEOS.filter((v) => v.unlocked).length}{" "}
          available now
        </span>
      </div>
      <ul>
        {VIDEOS.map((v) => (
          <VideoRow key={v.id} video={v} />
        ))}
      </ul>
    </section>
  );
}

function VideoRow({
  video,
}: {
  video: (typeof VIDEOS)[number];
}) {
  const inner = (
    <>
      <VideoThumb unlocked={video.unlocked} />
      <div className="flex-1">
        <p
          className={`text-[15px] ${
            video.unlocked ? "text-ink" : "text-muted-foreground/60"
          }`}
        >
          {video.title}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          Tier {video.roman} · {video.tier} · {video.length}
        </p>
      </div>
      {video.unlocked ? (
        <span className="text-[12.5px] text-forest">Watch</span>
      ) : (
        <Lock className="h-3.5 w-3.5 text-muted-foreground/70" />
      )}
    </>
  );

  if (!video.unlocked) {
    return (
      <li className="flex cursor-not-allowed items-center gap-4 border-b border-border/60 py-3 opacity-70">
        {inner}
      </li>
    );
  }
  return (
    <li>
      <Link
        to="/lesson"
        className="flex items-center gap-4 border-b border-border/60 py-3 transition-colors hover:bg-forest/5"
      >
        {inner}
      </Link>
    </li>
  );
}

function VideoThumb({ unlocked }: { unlocked: boolean }) {
  return (
    <div
      className={`relative flex h-14 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-[3px] border ${
        unlocked
          ? "border-border/70 bg-forest/10"
          : "border-border/60 bg-muted/40"
      }`}
    >
      {/* botanical silhouette */}
      <svg
        viewBox="0 0 96 56"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d="M0 46 C 20 40, 30 44, 48 38 S 78 32, 96 36 L 96 56 L 0 56 Z"
          fill={unlocked ? "var(--forest)" : "var(--muted-foreground)"}
          opacity="0.12"
        />
        <path
          d="M18 46 C 22 34, 30 30, 30 22"
          stroke={unlocked ? "var(--forest)" : "var(--muted-foreground)"}
          strokeWidth="1"
          fill="none"
          opacity="0.5"
        />
        <ellipse
          cx="30"
          cy="21"
          rx="3"
          ry="1.4"
          transform="rotate(-30 30 21)"
          fill={unlocked ? "var(--forest)" : "var(--muted-foreground)"}
          opacity="0.55"
        />
      </svg>
      <span
        className={`relative flex h-7 w-7 items-center justify-center rounded-full ${
          unlocked ? "bg-background text-forest" : "bg-background/70 text-muted-foreground"
        }`}
      >
        {unlocked ? <Play className="h-3 w-3" fill="currentColor" /> : <Lock className="h-3 w-3" />}
      </span>
    </div>
  );
}

export default Library;
