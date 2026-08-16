import { useEffect, useState } from "react";
import { Download, Printer, Lock } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { useJourney } from "@/hooks/useJourney";
import { TIER_NAME, toRoman } from "@/lib/journey";
import {
  deriveCertificate,
  formatCertificateDate,
  type CertificateState,
} from "@/lib/certificate";

const GOLD = "#D4A147";
const FOREST = "#3F7A5C";

function Certificate() {
  // Students are anonymous — Sprig holds a nickname and nothing else — so the
  // name is typed, not looked up. It starts empty rather than pre-filled with
  // an invented "Amelia Kestrel", which was the page's most convincing lie:
  // it made a stranger's finished certificate look like the student's own.
  const [name, setName] = useState("");
  const { journey, completions, loading } = useJourney();
  const certificate = deriveCertificate(journey, completions);
  const { earned } = certificate;

  // Printing blank means printing the same card with the name suppressed, so
  // it has to be rendered that way *before* the print dialog opens. Setting
  // state and calling window.print() in the same handler would print the
  // previous render — React has not committed yet — so the print is deferred
  // to an effect that runs after the commit.
  const [blank, setBlank] = useState(false);
  const [printQueued, setPrintQueued] = useState(false);

  useEffect(() => {
    if (!printQueued) return;
    window.print();
    setPrintQueued(false);
    setBlank(false);
  }, [printQueued]);

  function print(asBlank: boolean) {
    if (!earned) return; // belt and braces; the buttons are disabled too
    setBlank(asBlank);
    setPrintQueued(true);
  }

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

      {/* ─────────────── REQUIREMENT ─────────────── */}
      {!loading && !earned && (
        <section className="mx-auto max-w-[1120px] px-10 pb-8">
          <RequirementPanel certificate={certificate} />
        </section>
      )}

      {/* ─────────────── CERTIFICATE ─────────────── */}
      <section className="mx-auto max-w-[1120px] px-10 pb-16">
        <CertificateCard
          name={blank ? "" : name}
          date={formatCertificateDate(certificate.earnedOn)}
          certificate={certificate}
          loading={loading}
        />
      </section>

      {/* ─────────────── ACTIONS ─────────────── */}
      <section className="mx-auto max-w-[1120px] px-10 pb-16">
        <div className="rounded-2xl border border-border bg-card/60 p-8">
          {/* Underscore, not comma, between the track sizes. Tailwind v4 splits
              arbitrary values on commas, so `[1.2fr,1fr]` compiles to nothing
              and the two columns silently stack — which is what this panel has
              been doing. Progress.tsx already uses the underscore form. */}
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
                Your name on it
              </div>
              <h3 className="mt-3 font-display text-[22px] tracking-tight text-ink">
                {earned
                  ? "Type it in, and it appears in script."
                  : "Not yet — but this is what's waiting."}
              </h3>
              <p className="mt-3 max-w-[440px] text-[14px] leading-[1.65] text-muted-foreground">
                {earned ? (
                  <>
                    Change the name above and watch it re-render in the
                    certificate in a flowing Fraunces italic. Then save it as a
                    PDF — or print a blank version and fill your name in by
                    hand.
                  </>
                ) : (
                  <>
                    Saving and printing unlock once you've finished Essentials
                    and one optional branch. Until then the certificate above is
                    a preview, and it says so on its face — a keepsake for work
                    that hasn't happened yet wouldn't be worth keeping.
                  </>
                )}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => print(false)}
                  disabled={!earned}
                  aria-disabled={!earned}
                  title={earned ? undefined : "Finish Essentials and one optional branch first"}
                  className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-[13.5px] font-medium text-cream transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted"
                >
                  {earned ? <Download className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                  Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => print(true)}
                  disabled={!earned}
                  aria-disabled={!earned}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] text-muted-foreground transition hover:text-ink disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:text-muted-foreground/50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print blank version
                </button>
              </div>

              {earned && (
                <p className="mt-4 max-w-[440px] text-[12.5px] leading-[1.6] text-muted-foreground">
                  Both open your browser's print dialog — choose your printer,
                  or pick “Save as PDF” as the destination to keep a copy.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="certificate-name"
                className="block font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground"
              >
                Name on certificate
              </label>
              <input
                id="certificate-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!earned}
                placeholder={earned ? "Your name" : "Locked until earned"}
                className="mt-3 w-full border-b border-border bg-transparent pb-2 font-display text-[22px] italic text-ink outline-none transition focus:border-forest disabled:cursor-not-allowed disabled:text-muted-foreground/50"
              />
              <p className="mt-3 text-[12.5px] text-muted-foreground">
                {earned
                  ? "Rendered in Fraunces italic, exactly as it will appear."
                  : "Sprig never asks for your real name anywhere else — this stays in your browser and is never saved."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── WHAT THIS MEANS ─────────────── */}
      <section className="mx-auto max-w-[1120px] px-10 pb-24">
        <div className="grid gap-14 md:grid-cols-[1fr_1.2fr]">
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

/**
 * The card itself, in one of two states.
 *
 * It is the *same* card either way — not a separate "locked" placeholder —
 * because a student should be able to see exactly what they are working
 * towards. What changes is that an unearned card is muted, watermarked, has no
 * name on it, and lists progress rather than achievements. It is a preview
 * that cannot be mistaken for the real thing, which is the whole requirement.
 */
function CertificateCard({
  name,
  date,
  certificate,
  loading,
}: {
  name: string;
  date: string;
  certificate: CertificateState;
  loading: boolean;
}) {
  const { earned } = certificate;

  return (
    <div id="certificate-sheet" className="relative">
      {/* Outer gold hairline */}
      <div
        className={`rounded-[6px] p-[1px] transition-[filter,opacity] duration-500 ${
          earned ? "" : "opacity-[0.62] grayscale-[0.55]"
        }`}
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

              {/* Name field. Empty on an unearned card, and empty on a blank
                  print — the same "Your name" placeholder covers both, because
                  in both cases nobody has claimed this certificate yet. */}
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

            {/* Tiers. Real ones when earned; real progress when not. The
                hardcoded "I Essentials / III Mathematics" pair that used to
                sit here was the second-most convincing lie on the page: it
                named a tier the student may never have opened. */}
            <div className="mx-auto mt-10 max-w-[420px]">
              <div className="text-center font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                {earned ? "Tiers completed" : "Tiers in progress"}
              </div>
              <ul className="mt-4 space-y-2 text-[13.5px] text-ink/85">
                {loading ? (
                  <li className="text-center font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                    Loading…
                  </li>
                ) : earned ? (
                  certificate.completedTiers.map((t) => (
                    <TierLine
                      key={t.tier}
                      numeral={toRoman(t.tier)}
                      label={TIER_NAME[t.tier] ?? `Tier ${t.tier}`}
                      note="— complete"
                    />
                  ))
                ) : (
                  certificate.tiers.map((t) => (
                    <TierLine
                      key={t.tier}
                      numeral={toRoman(t.tier)}
                      label={TIER_NAME[t.tier] ?? `Tier ${t.tier}`}
                      note={t.complete ? "— complete" : `${t.completed} of ${t.total}`}
                      dim={!t.complete}
                    />
                  ))
                )}
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

          {/* Watermark. Sits inside the paper, above the content, and is the
              one thing that makes a screenshot of this preview unusable as a
              fake — the muting alone would survive a crop. `print-hide` is
              belt and braces: the print buttons are disabled while it shows. */}
          {!earned && !loading && (
            <div
              className="print-hide pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
              aria-hidden
            >
              <span
                className="-rotate-[18deg] whitespace-nowrap font-mono text-[clamp(28px,6vw,64px)] uppercase tracking-[0.3em]"
                style={{ color: "rgba(34,41,31,0.09)" }}
              >
                Not yet earned
              </span>
            </div>
          )}
        </div>
      </div>

      {!earned && !loading && (
        <div className="pointer-events-none absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Preview
        </div>
      )}
    </div>
  );
}

function TierLine({
  numeral,
  label,
  note,
  dim,
}: {
  numeral: string;
  label: string;
  note: string;
  dim?: boolean;
}) {
  return (
    <li className={`flex items-baseline gap-4 ${dim ? "opacity-55" : ""}`}>
      <span
        className="w-8 shrink-0 text-right font-display text-[13px] italic"
        style={{ color: GOLD }}
      >
        {numeral}
      </span>
      <span className="flex-1 border-b border-dotted border-border/80" />
      <span className="text-ink">{label}</span>
      <span className="text-muted-foreground">{note}</span>
    </li>
  );
}

/**
 * What is actually left to do, in plain numbers.
 *
 * A greyed-out button with no explanation is the worst version of a gate: the
 * student can see they are locked out but not why or how far off they are.
 * This panel answers both, using the same counts the rule itself runs on.
 */
function RequirementPanel({ certificate }: { certificate: CertificateState }) {
  const trunk = certificate.tiers.find((t) => t.tier === 1) ?? null;
  const optional = certificate.tiers.filter((t) => t.tier !== 1);
  // The nearest optional branch, so the encouragement points somewhere real
  // rather than at whichever tier happens to sort first.
  const closest = [...optional].sort(
    (a, b) => b.completed / (b.total || 1) - a.completed / (a.total || 1),
  )[0];

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-8">
      <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span>Not yet earned</span>
      </div>

      <h2 className="mt-4 max-w-[620px] font-display text-[26px] leading-[1.15] tracking-tight text-ink">
        Two things unlock this certificate.
      </h2>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <RequirementRow
          label="Tier I — Essentials"
          met={certificate.trunkComplete}
          detail={trunk ? `${trunk.completed} of ${trunk.total} lessons done` : "No content yet"}
        />
        <RequirementRow
          label="One optional branch"
          met={optional.some((t) => t.complete)}
          detail={
            optional.some((t) => t.complete)
              ? `${TIER_NAME[optional.find((t) => t.complete)!.tier]} complete`
              : closest
                ? `Closest: ${TIER_NAME[closest.tier] ?? `Tier ${closest.tier}`} — ${closest.completed} of ${closest.total}`
                : "No content yet"
          }
        />
      </div>

      <p className="mt-7 max-w-[620px] text-[14px] leading-[1.65] text-muted-foreground">
        Essentials is the trunk; Application, Mathematics and Mastery are the
        three branches. Finish the trunk and any one branch and this page
        unlocks — finish more and they're added to the certificate.
      </p>
    </div>
  );
}

function RequirementRow({
  label,
  met,
  detail,
}: {
  label: string;
  met: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${
          met ? "border-forest bg-forest text-cream" : "border-border text-muted-foreground/70"
        }`}
      >
        {met ? "✓" : ""}
      </span>
      <div>
        <div className={`text-[14.5px] ${met ? "text-ink" : "text-foreground/80"}`}>{label}</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {detail}
        </div>
      </div>
    </div>
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
