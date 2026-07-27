import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import {
  fetchTeacherStudents,
  resetStudentPin,
  unlockStudent,
  type TeacherStudent,
} from "@/lib/teacherAuth";

/**
 * The teacher's class list, and the two things a teacher needs mid-lesson.
 *
 * Scope is deliberately one screen. A student cannot get in for exactly two
 * reasons — they're locked out after five wrong PINs, or they've forgotten
 * their PIN entirely — and until now neither had a remedy that didn't involve
 * waiting fifteen minutes or losing the account. Everything else a teacher
 * might eventually want (class progress, adding students, moving them between
 * classes) is absent on purpose; this is the part that makes a lesson
 * salvageable.
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

    fetchTeacherStudents().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setStudents(result.students);
        setError(null);
      } else {
        setError(result.message);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

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

        <div className="mt-14 border border-border/70 bg-background/40">
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
