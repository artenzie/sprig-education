import { useMemo, useState } from "react";
import { resetStudentPin, unlockStudent } from "@/lib/teacherAuth";
import { EMPTY_JOURNEY, toRoman, type Journey } from "@/lib/journey";
import type { HostStudent, HostTeacher } from "@/lib/hostData";
import { Section } from "./HostSection";

/**
 * Every student in the pilot, expandable, with the two account actions.
 *
 * THE ACTIONS ARE THE TEACHER ONES, UNCHANGED. This file imports
 * unlockStudent() and resetStudentPin() from teacherAuth.ts and calls them
 * exactly as TeacherStudents.tsx does — no host variant, no second code path.
 * What makes them work across every class is one line in the database:
 * teacher_unlock_student() and teacher_reset_pin() now guard on
 * may_act_on_student() instead of teacher_owns_student()
 * (supabase/migrations/20260818020000_host_tools.sql).
 *
 * That is worth being deliberate about rather than incidental. A host-specific
 * reset function in the browser would have been a second implementation of
 * "replace a PIN, force a change, clear the lockout, kill live sessions" — four
 * writes that have to happen together — and the two copies would eventually
 * disagree. Sharing the client code means the only difference between a
 * teacher's reset and a host's is who the database will permit it for.
 *
 * NO RAW PINS ANYWHERE. There is no column to show: a PIN is a bcrypt hash in
 * auth.users and is genuinely unrecoverable, by a host as much as by anyone.
 * The reset flow below is the whole answer to "what if a student forgets", and
 * the new PIN it reveals exists in readable form for exactly as long as the
 * panel is open.
 */
export function HostStudentTable({
  students,
  journeys,
  teachersById,
  onChanged,
}: {
  students: HostStudent[];
  journeys: Map<string, Journey>;
  teachersById: Map<string, HostTeacher>;
  /** Re-run the page's load, after an action that changed something. */
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // One action at a time, same rule as the teacher roster: these are
  // deliberate, and two overlapping resets would be impossible to read.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; pin: string } | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  // Ninety-odd rows is past the point where scrolling to find one student
  // during a lesson is reasonable. Matches nickname and school, because those
  // are the two things somebody would have in front of them.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) => {
      const teacher = student.teacher_id ? teachersById.get(student.teacher_id) : undefined;
      const haystack = [student.nickname, teacher?.school_name ?? "", teacher?.email ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [students, teachersById, query]);

  async function handleUnlock(student: HostStudent) {
    setBusyId(student.id);
    setActionError(null);
    const result = await unlockStudent(student.id);
    if (!result.ok) setActionError({ id: student.id, message: result.message });
    setBusyId(null);
    if (result.ok) onChanged();
  }

  async function handleReset(student: HostStudent) {
    setBusyId(student.id);
    setActionError(null);
    const result = await resetStudentPin(student.id);
    if (result.ok) {
      setRevealed({ id: student.id, pin: result.pin });
    } else {
      setActionError({ id: student.id, message: result.message });
    }
    setBusyId(null);
    setConfirmingId(null);
    if (result.ok) onChanged();
  }

  return (
    <Section
      label="Every student"
      summary={
        query.trim()
          ? `${filtered.length} of ${students.length}`
          : `${students.length} across ${teachersById.size} teacher${teachersById.size === 1 ? "" : "s"}`
      }
    >
      <div className="border-b border-border/70 px-8 py-5">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by nickname or school"
          aria-label="Filter students by nickname or school"
          className="w-full max-w-sm border-b border-border/70 bg-transparent pb-2 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-forest"
        />
      </div>

      {students.length === 0 ? (
        <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
          No students yet.
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-8 py-10 text-[14.5px] leading-[1.7] text-muted-foreground">
          Nobody matches “{query.trim()}”.
        </p>
      ) : (
        <ul className="divide-y divide-border/70">
          {filtered.map((student) => (
            <StudentRow
              key={student.id}
              student={student}
              journey={journeys.get(student.id) ?? EMPTY_JOURNEY}
              teacher={student.teacher_id ? teachersById.get(student.teacher_id) : undefined}
              expanded={expandedId === student.id}
              onToggle={() =>
                setExpandedId((current) => (current === student.id ? null : student.id))
              }
              busy={busyId === student.id}
              disabled={busyId !== null && busyId !== student.id}
              confirming={confirmingId === student.id}
              revealedPin={revealed?.id === student.id ? revealed.pin : null}
              error={actionError?.id === student.id ? actionError.message : null}
              onUnlock={() => void handleUnlock(student)}
              onAskReset={() => {
                setActionError(null);
                setConfirmingId(student.id);
              }}
              onCancelReset={() => setConfirmingId(null)}
              onConfirmReset={() => void handleReset(student)}
              onDismissPin={() => setRevealed(null)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function StudentRow({
  student,
  journey,
  teacher,
  expanded,
  onToggle,
  busy,
  disabled,
  confirming,
  revealedPin,
  error,
  onUnlock,
  onAskReset,
  onCancelReset,
  onConfirmReset,
  onDismissPin,
}: {
  student: HostStudent;
  journey: Journey;
  teacher: HostTeacher | undefined;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  disabled: boolean;
  confirming: boolean;
  revealedPin: string | null;
  error: string | null;
  onUnlock: () => void;
  onAskReset: () => void;
  onCancelReset: () => void;
  onConfirmReset: () => void;
  onDismissPin: () => void;
}) {
  const locked = student.locked_until !== null;

  return (
    <li className="px-8 py-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-foreground">
            {student.nickname}
          </span>
          <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {/* Unassigned is called out rather than left blank: it means no
                teacher can see this student at all, which is a fixable
                mistake and not a display quirk. */}
            {teacher?.school_name ?? teacher?.email ?? "Unassigned"}
          </span>
        </span>

        <span className="flex items-center gap-6">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            Tier {toRoman(student.current_tier)}
          </span>
          <span className="w-28 text-right font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {journey.totalSubtopics === 0
              ? "—"
              : `${journey.percentComplete}% · ${journey.completedSubtopics}/${journey.totalSubtopics}`}
          </span>
          {locked && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[color:var(--destructive)]">
              Locked
            </span>
          )}
          {!locked && student.must_change_pin && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
              New PIN
            </span>
          )}
          <span aria-hidden className="font-mono text-[13px] text-muted-foreground">
            {expanded ? "−" : "+"}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="mt-5 border-t border-border/60 pt-5">
          <dl className="flex flex-wrap gap-x-12 gap-y-3">
            <Detail term="Teacher" value={teacher?.email ?? "None — not assigned to anyone"} />
            <Detail term="School" value={teacher?.school_name ?? "—"} />
            <Detail
              term="Account"
              value={
                locked
                  ? `Locked for ${minutesLeft(student.locked_until!)} more minutes`
                  : student.must_change_pin
                    ? "Still on a PIN somebody else chose"
                    : "Normal"
              }
            />
            <Detail
              term="Current topic"
              value={
                journey.currentTopic
                  ? `Tier ${toRoman(journey.currentTopic.tier)} · ${journey.currentTopic.title}`
                  : journey.completedSubtopics === journey.totalSubtopics &&
                      journey.totalSubtopics > 0
                    ? "All available content finished"
                    : "Not started"
              }
            />
          </dl>

          {!revealedPin && !confirming && (
            <div className="mt-5 flex items-center gap-3">
              {locked && (
                <RowButton onClick={onUnlock} disabled={busy || disabled}>
                  {busy ? "Unlocking" : "Unlock"}
                </RowButton>
              )}
              <RowButton onClick={onAskReset} disabled={busy || disabled}>
                Reset PIN
              </RowButton>
            </div>
          )}

          {confirming && !revealedPin && (
            <div className="mt-5 border border-border/70 bg-background/60 px-6 py-5">
              <p className="text-[13.5px] leading-[1.7] text-muted-foreground">
                This replaces{" "}
                <span className="text-foreground">{student.nickname}</span>'s PIN with a
                new one and signs them out everywhere. You'll see the new PIN once, and{" "}
                {teacher ? `their teacher (${teacher.email})` : "nobody else"} will need
                telling.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <RowButton onClick={onConfirmReset} disabled={busy} emphasis>
                  {busy ? "Resetting" : "Reset it"}
                </RowButton>
                <RowButton onClick={onCancelReset} disabled={busy}>
                  Cancel
                </RowButton>
              </div>
            </div>
          )}

          {revealedPin && (
            <div className="mt-5 border border-forest/30 bg-forest/[0.05] px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                New PIN for {student.nickname}
              </p>
              <p className="mt-3 font-mono text-[30px] tracking-[0.3em] text-foreground">
                {revealedPin}
              </p>
              <p className="mt-3 max-w-md text-[13px] leading-[1.7] text-muted-foreground">
                This won't be shown again and nobody can look it up later. They'll be
                asked to choose their own PIN when they next log in.
              </p>
              <div className="mt-4">
                <RowButton onClick={onDismissPin}>Done</RowButton>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 text-[13px] leading-[1.6] text-[color:var(--destructive)]"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {term}
      </dt>
      <dd className="mt-1.5 text-[13.5px] leading-[1.6] text-foreground">{value}</dd>
    </div>
  );
}

function RowButton({
  onClick,
  disabled,
  emphasis = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.24em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        emphasis
          ? "border-forest bg-forest text-primary-foreground"
          : "border-border/70 text-muted-foreground hover:border-forest hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Always at least 1 — "0 min left" reads as "not locked", which it isn't. */
function minutesLeft(lockedUntil: string): number {
  const ms = new Date(lockedUntil).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 60000));
}
