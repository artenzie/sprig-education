import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth";
import {
  fetchTeacherStudents,
  resetStudentPin,
  unlockStudent,
  type TeacherStudent,
} from "@/lib/teacherAuth";
import {
  fetchClassProgress,
  classAverageCompletion,
  classTopicCompletion,
  type ClassProgressData,
} from "@/lib/teacherProgress";
import { deriveJourney, EMPTY_JOURNEY, toRoman, type Journey } from "@/lib/journey";
import { TopicBars } from "@/components/sprig/TopicBars";

/**
 * The teacher's class list — read-only class progress, plus the two things a
 * teacher needs mid-lesson.
 *
 * A student cannot get in for exactly two reasons — they're locked out after
 * five wrong PINs, or they've forgotten their PIN entirely — and neither had
 * a remedy that didn't involve waiting fifteen minutes or losing the account
 * until the Unlock/Reset PIN tooling below was built. Class progress is the
 * other half: what a teacher can see is deliberately narrow, matching the new
 * RLS policy in 20260809000000_teacher_read_class_progress.sql — completions
 * only, never a score or an answer. Adding students or moving them between
 * classes is still absent on purpose; that stays out of scope.
 *
 * Note this page does NOT use <TopNav />. That component is student-shaped all
 * the way through — Journey, Growth, Library, Certificate, a student avatar, a
 * "Change PIN" item — and a teacher has none of those. Making it role-aware is
 * a real piece of work and this isn't the session for it, so there's a small
 * local header instead.
 */
function TeacherStudents() {
  const { teacher, signOut } = useAuth();

  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [classProgress, setClassProgress] = useState<ClassProgressData | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

  // Bumped to re-run the load — the same manual-reload idiom as useJourney.
  const [nonce, setNonce] = useState(0);

  // Which row has an action in flight. One at a time: these actions are
  // deliberate, and two overlapping resets would be very hard to read.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; pin: string } | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    // React 19's StrictMode mounts effects twice in development; without this
    // guard a slow first response can land after the second one and overwrite
    // fresher data with staler data.
    let cancelled = false;
    setLoading(true);

    // Fired together, same as the roster/lockouts pair below: a broken class-
    // progress read shouldn't stop the roster (and its Unlock/Reset PIN
    // actions) from loading — it just leaves the progress section showing its
    // own error instead.
    Promise.all([fetchTeacherStudents(), fetchClassProgress()]).then(([rosterResult, progressResult]) => {
      if (cancelled) return;

      if (rosterResult.ok) {
        setStudents(rosterResult.students);
        setError(null);
      } else {
        setError(rosterResult.message);
      }

      if (progressResult.ok) {
        setClassProgress(progressResult.data);
        setProgressError(null);
      } else {
        setClassProgress(null);
        setProgressError(progressResult.message);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // One Journey per student, built with the SAME deriveJourney() a student's
  // own dashboard uses — no second copy of the tier/percent/unlock rules.
  const journeyByStudentId = useMemo(() => {
    const map = new Map<string, Journey>();
    if (!classProgress) return map;
    for (const student of students) {
      map.set(
        student.id,
        deriveJourney(classProgress.topics, classProgress.progressByStudentId.get(student.id) ?? new Set()),
      );
    }
    return map;
  }, [students, classProgress]);

  const journeys = useMemo(() => [...journeyByStudentId.values()], [journeyByStudentId]);
  const topicCompletion = classProgress ? classTopicCompletion(classProgress.topics, journeys) : [];
  const classAverage = classAverageCompletion(journeys);

  async function handleUnlock(student: TeacherStudent) {
    setBusyId(student.id);
    setActionError(null);
    try {
      const result = await unlockStudent(student.id);
      if (!result.ok) {
        setActionError({ id: student.id, message: result.message });
        return;
      }
      reload();
    } finally {
      setBusyId(null);
    }
  }

  async function handleReset(student: TeacherStudent) {
    setBusyId(student.id);
    setActionError(null);
    try {
      const result = await resetStudentPin(student.id);
      if (!result.ok) {
        setActionError({ id: student.id, message: result.message });
        return;
      }
      setConfirmingId(null);
      setRevealed({ id: student.id, pin: result.pin });
      // Deliberately no reload here. Re-fetching would re-render the row and
      // there is exactly one moment in this PIN's existence when it can be
      // read — losing it to a refresh would mean resetting again.
    } finally {
      setBusyId(null);
    }
  }

  function dismissPin() {
    setRevealed(null);
    reload();
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-10 py-5">
          <span className="font-display text-[19px] font-normal tracking-[-0.02em]">
            Sprig
          </span>
          <div className="flex items-center gap-7">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
              {teacher?.school_name ?? teacher?.email ?? "Teacher"}
            </span>
            <button
              onClick={() => void signOut()}
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-10 pb-24 pt-16">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Your class</span>
          <span className="h-px w-8 bg-border" />
          <span>
            {students.length} student{students.length === 1 ? "" : "s"}
          </span>
        </div>

        <h1 className="mt-10 font-display text-[54px] font-normal leading-[1.02] tracking-[-0.035em]">
          Getting them <em className="font-normal italic text-forest">back in</em>.
        </h1>

        <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-muted-foreground">
          Five wrong PINs locks an account for fifteen minutes. You can lift
          that straight away. A forgotten PIN can't be looked up — nobody can
          read it, including us — so it gets replaced with a new one instead.
        </p>

        {/* Class progress — completions only, never a score. See the RLS
            policy note at the top of this file. */}
        <div className="mt-16">
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
            <span>Class progress</span>
            <span className="h-px w-8 bg-border" />
            <span>
              {loading || students.length === 0 ? "—" : `${classAverage}% average complete`}
            </span>
          </div>

          <div className="mt-6 border border-border/70 bg-background/40 px-8 py-10">
            {loading ? (
              <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
                Loading class progress
              </p>
            ) : progressError ? (
              <p role="alert" className="text-[13px] leading-[1.6] text-[color:var(--destructive)]">
                {progressError}
              </p>
            ) : students.length === 0 ? (
              <p className="text-[14.5px] leading-[1.7] text-muted-foreground">
                No students yet — this fills in once your class has one.
              </p>
            ) : topicCompletion.length === 0 ? (
              <p className="text-[14.5px] leading-[1.7] text-muted-foreground">
                Nothing finished yet — this fills in as the class completes lessons.
              </p>
            ) : (
              <TopicBars
                items={topicCompletion}
                ariaLabel="Percentage of the class that has completed each topic"
              />
            )}
          </div>
        </div>

        <div className="mt-16 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Roster</span>
          <span className="h-px w-8 bg-border" />
        </div>

        <div className="mt-6 border border-border/70 bg-background/40">
          {loading ? (
            <p className="px-8 py-10 font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
              Loading your class
            </p>
          ) : error ? (
            <div className="px-8 py-10">
              <p role="alert" className="text-[13px] leading-[1.6] text-[color:var(--destructive)]">
                {error}
              </p>
              <button
                onClick={reload}
                className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                Try again
              </button>
            </div>
          ) : students.length === 0 ? (
            <EmptyClass />
          ) : (
            <ul className="divide-y divide-border/70">
              {students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  journey={journeyByStudentId.get(student.id) ?? EMPTY_JOURNEY}
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
                  onDismissPin={dismissPin}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StudentRow({
  student,
  journey,
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
  student: TeacherStudent;
  journey: Journey;
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
    <li className="px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-medium text-foreground">{student.nickname}</p>
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            {locked ? (
              <span className="text-[color:var(--destructive)]">
                Locked · {minutesLeft(student.locked_until!)} min left
              </span>
            ) : student.must_change_pin ? (
              "Hasn't chosen a PIN yet"
            ) : (
              "—"
            )}
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">
            {progressLabel(journey)}
          </p>
        </div>

        {/* While the PIN is on screen the actions go away. There is nothing
            useful to do to this student until it's been read and dismissed,
            and leaving a second "Reset PIN" button next to a PIN somebody is
            reading aloud invites exactly one mistake. */}
        {!revealedPin && !confirming && (
          <div className="flex items-center gap-3">
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
      </div>

      {/* Inline rather than window.confirm(). A native dialog blocks the whole
          page, reads as a browser warning rather than part of Sprig, and on a
          school-managed browser can be suppressed entirely. */}
      {confirming && !revealedPin && (
        <div className="mt-5 border border-border/70 bg-background/60 px-6 py-5">
          <p className="text-[13.5px] leading-[1.7] text-muted-foreground">
            This replaces <span className="text-foreground">{student.nickname}</span>'s PIN
            with a new one and signs them out everywhere. You'll see the new PIN
            once, to read out to them.
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
            Read this to them now — it won't be shown again, and nobody can look
            it up later. They'll be asked to choose their own PIN when they log
            in.
          </p>
          <div className="mt-4">
            <RowButton onClick={onDismissPin}>Done</RowButton>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-[13px] leading-[1.6] text-[color:var(--destructive)]">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * "Tier I · Budgeting · 4/13", or a fallback for the two edges: nothing
 * loaded yet (totalSubtopics === 0, indistinguishable from a genuinely empty
 * curriculum — both read as "—"), and everything available finished, where
 * currentTopic is null because tiers 2-4 have no content for deriveJourney()
 * to call "current" yet — see the guard in src/lib/journey.ts.
 */
function progressLabel(journey: Journey): string {
  if (journey.totalSubtopics === 0) return "—";
  const fraction = `${journey.completedSubtopics}/${journey.totalSubtopics}`;
  if (journey.currentTopic) {
    return `Tier ${toRoman(journey.currentTopic.tier)} · ${journey.currentTopic.title} · ${fraction}`;
  }
  return journey.completedSubtopics === journey.totalSubtopics
    ? `All available content finished · ${fraction}`
    : `${fraction} complete`;
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

/**
 * Almost always one specific cause, so it says so rather than shrugging.
 *
 * students.teacher_id is nullable and was only ever written by the --teacher
 * flag on scripts/create-students.ts. Any class created before teacher accounts
 * existed has null there, and the RLS policy matches nothing — null is never
 * equal to anything, including a teacher's id.
 */
function EmptyClass() {
  return (
    <div className="px-8 py-12">
      <p className="text-[15px] leading-[1.7] text-foreground">No students yet.</p>
      <p className="mt-3 max-w-lg text-[13.5px] leading-[1.7] text-muted-foreground">
        Students are created from the command line and assigned to you with the{" "}
        <code className="font-mono text-[12.5px] text-foreground">--teacher</code> flag.
        If you expected to see a class here, they were probably created without
        it and need assigning.
      </p>
    </div>
  );
}

/** Always at least 1 — "0 min left" reads as "not locked", which it isn't. */
function minutesLeft(lockedUntil: string): number {
  const ms = new Date(lockedUntil).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 60000));
}

export default TeacherStudents;
