import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

const GOLD = "#D4A147";
const FOREST = "#3F7A5C";

function Certificate() {
  const [name, setName] = useState("Amelia Kestrel");
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <TopNav />

      <section className="mx-auto max-w-[1120px] px-10 pb-8 pt-16">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Keepsake</span>
          <span className="h-px w-8 bg-border" />
          <span>Certificate of Growth</span>
        </div>

        <h1 className="mt-6 font-display text-[44px] leading-[1.05] tracking-tight text-ink">
          A small paper record<br />
          <span className="italic text-forest">of what you've grown.</span>
        </h1>
        <p className="mt-5 max-w-[560px] text-[15px] leading-[1.65] text-muted-foreground">
          When your sprig is fully grown — Essentials plus one of the optional
          tiers — this certificate is yours to keep, print, or share.
        </p>
      </section>

      {/* ─────────────── CERTIFICATE ─────────────── */}
      <section className="mx-auto max-w-[1120px] px-10 pb-16">
        <CertificateCard name={name} date={today} />
      </section>

      {/* ─────────────── ACTIONS ─────────────── */}
      <section className="mx-auto max-w-[1120px] px-10 pb-16">
        <div className="rounded-2xl border border-border bg-card/60 p-8">
          <div className="grid gap-8 md:grid-cols-[1.2fr,1fr]">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
                Your name on it
              </div>
              <h3 className="mt-3 font-display text-[22px] tracking-tight text-ink">
                Type it in, and it appears in script.
              </h3>
              <p className="mt-3 max-w-[440px] text-[14px] leading-[1.65] text-muted-foreground">
                Change the name above and watch it re-render in the certificate
                in a flowing Fraunces italic. Then download the PDF — or print
                a blank version and fill your name in by hand.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[13.5px] font-medium text-cream transition hover:bg-forest/90"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] text-muted-foreground transition hover:text-ink">
                  <Printer className="h-3.5 w-3.5" />
                  Print blank version
                </button>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
                Name on certificate
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-3 w-full border-b border-border bg-transparent pb-2 font-display text-[22px] italic text-ink outline-none transition focus:border-forest"
              />
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                Rendered in Fraunces italic, exactly as it will appear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── WHAT THIS MEANS ─────────────── */}
      <section className="mx-auto max-w-[1120px] px-10 pb-24">
        <div className="grid gap-14 md:grid-cols-[1fr,1.2fr]">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
              What this means
            </div>
            <h2 className="mt-4 font-display text-[32px] leading-[1.1] tracking-tight text-ink">
              A personal achievement,<br />
              <span className="italic text-forest">not a formal qualification.</span>
            </h2>
          </div>

          <div className="space-y-6 text-[15px] leading-[1.75] text-ink/85">
            <p>
              This certificate isn't a professional credential and it doesn't
              appear on any transcript. It's a keepsake — a way to mark that you
              actually did the work of learning how money behaves in real life.
              Something to be proud of, and to show a parent, teacher, or
              friend.
            </p>
            <p>
              To earn it, you complete <span className="text-forest">Tier 1 — Essentials</span>{" "}
              (the trunk of your sprig) and at least one of the three optional
              branches: <span className="text-forest">Application</span>,{" "}
              <span className="text-forest">Mathematics</span>, or{" "}
              <span className="text-forest">Mastery</span>. Finish more tiers and
              they're added to the certificate.
            </p>
            <p className="text-muted-foreground">
              Two ways to have it: type your name in for a printed or PDF
              version with your name set in a beautiful script, or print a blank
              version and write your name in by hand.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */

function CertificateCard({ name, date }: { name: string; date: string }) {
  return (
    <div className="relative">
      {/* Outer gold hairline */}
      <div
        className="rounded-[6px] p-[1px]"
        style={{ background: `linear-gradient(180deg, ${GOLD}, ${GOLD}55)` }}
      >
        {/* Paper */}
        <div
          className="relative rounded-[5px] bg-[#FBFAF4] px-16 py-14"
          style={{
            boxShadow:
              "0 1px 0 rgba(0,0,0,0.03), 0 30px 60px -30px rgba(34,41,31,0.18)",
          }}
        >
          {/* Inner hairline frame */}
          <div
            className="pointer-events-none absolute inset-4 rounded-[3px] border"
            style={{ borderColor: "#E0DED4" }}
          />
          {/* Corner flourishes */}
          <CornerFlourish className="absolute left-6 top-6" />
          <CornerFlourish className="absolute right-6 top-6 -scale-x-100" />
          <CornerFlourish className="absolute left-6 bottom-6 -scale-y-100" />
          <CornerFlourish className="absolute right-6 bottom-6 -scale-x-100 -scale-y-100" />

          {/* Content */}
          <div className="relative">
            {/* Header mark */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <SprigMark />
                <span className="font-display text-[15px] tracking-[0.02em] text-ink">
                  Sprig
                </span>
              </div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.32em] text-muted-foreground">
                A field guide to money
              </div>
            </div>

            {/* Divider */}
            <div className="mx-auto mt-8 flex max-w-[420px] items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span
                className="h-1.5 w-1.5 rotate-45"
                style={{ background: GOLD }}
              />
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* Headline */}
            <h2 className="mt-8 text-center font-display text-[44px] leading-[1.05] tracking-tight text-ink">
              Certificate of Growth
            </h2>
            <p className="mt-4 text-center font-mono text-[10.5px] uppercase tracking-[0.34em] text-muted-foreground">
              Awarded by Sprig · MMXXVI
            </p>

            {/* Body */}
            <div className="mx-auto mt-12 max-w-[640px] text-center">
              <p className="text-[14px] leading-[1.8] text-ink/80">
                This certifies that
              </p>

              {/* Name field */}
              <div className="mx-auto mt-4 max-w-[520px]">
                <div
                  className="pb-1 font-display text-[38px] italic leading-[1.1] text-ink"
                  style={{ borderBottom: `1px solid ${GOLD}` }}
                >
                  {name || <span className="text-muted-foreground/60">Your name</span>}
                </div>
                <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.3em] text-muted-foreground">
                  — recipient —
                </div>
              </div>

              <p className="mx-auto mt-8 max-w-[560px] text-[15px] leading-[1.85] text-ink/85">
                has grown their sprig into a full understanding of
                personal finance — completing the essentials of money
                and continuing beyond, branch by branch.
              </p>
            </div>

            {/* Tiers completed */}
            <div className="mx-auto mt-10 max-w-[420px]">
              <div className="text-center font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                Tiers completed
              </div>
              <ul className="mt-4 space-y-2 text-[13.5px] text-ink/85">
                <TierLine numeral="I" label="Essentials" />
                <TierLine numeral="III" label="Mathematics" />
              </ul>
            </div>

            {/* Seal + Signature row */}
            <div className="mt-14 grid grid-cols-3 items-end gap-6">
              {/* Date (left) */}
              <div>
                <div className="font-display text-[16px] italic text-ink">
                  {date}
                </div>
                <div
                  className="mt-1.5 h-px w-32"
                  style={{ background: "#E0DED4" }}
                />
                <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.3em] text-muted-foreground">
                  Date earned
                </div>
              </div>

              {/* Seal (center) */}
              <div className="flex justify-center">
                <Seal />
              </div>

              {/* Signature (right) */}
              <div className="text-right">
                <div className="font-display text-[22px] italic leading-none text-ink">
                  Artem Makarov
                </div>
                <div
                  className="ml-auto mt-1.5 h-px w-40"
                  style={{ background: "#E0DED4" }}
                />
                <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.3em] text-muted-foreground">
                  Founder, Sprig
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TierLine({ numeral, label }: { numeral: string; label: string }) {
  return (
    <li className="flex items-baseline gap-4">
      <span
        className="w-8 shrink-0 text-right font-display text-[13px] italic"
        style={{ color: GOLD }}
      >
        {numeral}
      </span>
      <span className="flex-1 border-b border-dotted border-border/80" />
      <span className="text-ink">{label}</span>
      <span className="text-muted-foreground">— complete</span>
    </li>
  );
}

function Seal() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" fill="none" aria-hidden>
      <circle cx="64" cy="64" r="58" stroke={GOLD} strokeWidth="0.9" fill="none" />
      <circle
        cx="64"
        cy="64"
        r="50"
        stroke={GOLD}
        strokeWidth="0.5"
        strokeDasharray="1 3"
        fill="none"
      />
      {/* Sprig wordmark */}
      <text
        x="64"
        y="44"
        textAnchor="middle"
        fontFamily="Fraunces, serif"
        fontStyle="italic"
        fontSize="12"
        fill={GOLD}
        letterSpacing="0.4"
      >
        Sprig
      </text>
      {/* Sprig icon, centered */}
      <g transform="translate(50 52)">
        <path
          d="M14 24 C 14 15, 9 11, 6 9"
          stroke={FOREST}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M14 18 C 16 16, 19 15, 22 14"
          stroke={FOREST}
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="5" cy="8" rx="2.6" ry="1.4" transform="rotate(-30 5 8)" fill={FOREST} />
        <ellipse cx="22.4" cy="13.6" rx="2.4" ry="1.3" transform="rotate(20 22.4 13.6)" fill={GOLD} />
      </g>
      {/* Motto */}
      <text
        x="64"
        y="104"
        textAnchor="middle"
        fontFamily="Fraunces, serif"
        fontStyle="italic"
        fontSize="9"
        fill={GOLD}
        letterSpacing="0.35"
      >
        grown, not given
      </text>
    </svg>
  );
}

function CornerFlourish({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 20 C 2 10, 10 2, 20 2"
        stroke={GOLD}
        strokeWidth="0.7"
        fill="none"
      />
      <path
        d="M6 22 C 6 14, 14 6, 22 6"
        stroke={GOLD}
        strokeWidth="0.4"
        fill="none"
        opacity="0.6"
      />
      <circle cx="2" cy="20" r="1" fill={GOLD} />
      <circle cx="20" cy="2" r="1" fill={GOLD} />
    </svg>
  );
}

function SprigMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path
        d="M13 22 C 13 14, 8 10, 5 8"
        stroke={FOREST}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M13 16 C 15 14, 18 13, 21 12"
        stroke={FOREST}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="4" cy="7" rx="2.4" ry="1.3" transform="rotate(-30 4 7)" fill={FOREST} />
      <ellipse cx="21.4" cy="11.6" rx="2.2" ry="1.2" transform="rotate(20 21.4 11.6)" fill={GOLD} />
    </svg>
  );
}

export default Certificate;
