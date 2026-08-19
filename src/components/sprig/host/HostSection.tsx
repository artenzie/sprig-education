import type { ReactNode } from "react";

/**
 * The chrome every host section shares.
 *
 * Pulled out because the host dashboard is six sections of the same shape and
 * TeacherStudents.tsx already repeats this markup twice — an eyebrow label, a
 * hairline, a right-hand summary, then a bordered panel. Three copies is the
 * point at which it becomes a component rather than a pattern.
 *
 * The look is lifted directly from that page rather than invented: mono
 * uppercase eyebrows, hairline borders, no cards-in-cards. The host dashboard
 * should read as the same product as the teacher one, not as an admin panel
 * bolted on the side.
 */
export function Section({
  label,
  summary,
  children,
}: {
  label: string;
  /** The right-hand figure after the rule — a count, a percentage, a dash. */
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-16">
      <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        <span>{label}</span>
        <span className="h-px w-8 bg-border" />
        {summary !== undefined && <span>{summary}</span>}
      </div>
      <div className="mt-6 border border-border/70 bg-background/40">{children}</div>
    </div>
  );
}

/** A single headline number with its label underneath. */
export function StatTile({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  /** A second line, for the caveat a bare number would hide. */
  hint?: string;
}) {
  return (
    <div className="px-8 py-7">
      <p className="font-display text-[38px] font-normal leading-none tracking-[-0.03em] text-foreground">
        {value}
      </p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      {hint && <p className="mt-2 text-[12.5px] leading-[1.6] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * What a section shows when it has nothing to show.
 *
 * Deliberately distinguishes "nobody has done this yet" from "this is broken",
 * because on a pilot dashboard the first is the normal state for weeks and
 * reading it as the second would send someone debugging a working page.
 */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">{children}</p>
  );
}

export function SectionError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="px-8 py-10 text-[13px] leading-[1.6] text-[color:var(--destructive)]">
      {children}
    </p>
  );
}
