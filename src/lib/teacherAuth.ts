/**
 * The teacher's side of the database.
 *
 * Four calls, and a deliberate split between how the two kinds of data arrive:
 *
 *   THE ROSTER is an ordinary select on `students`. It works because of the
 *   "Teachers read their own students" RLS policy added in
 *   supabase/migrations/20260727000000_teacher_accounts.sql — `using
 *   (auth.uid() = teacher_id)`. Note there is no `.eq("teacher_id", ...)`
 *   anywhere below. Filtering here as well would be a second, weaker copy of a
 *   rule the database already enforces, and worse, it would make the safety
 *   look like it came from the query — so that deleting the filter one day
 *   would look harmless. It isn't a filter; it's a policy.
 *
 *   THE ACTIONS are RPCs into security-definer functions, because each one
 *   does something a teacher's own session is not allowed to do: write to
 *   login_attempts (which no client can touch at all), or rewrite a bcrypt
 *   hash in auth.users. The functions check ownership themselves, in the
 *   database, from auth.uid() — never from anything passed in from here. What
 *   this file sends is a student id; what decides whether that is allowed is a
 *   JWT the browser cannot forge.
 *
 *   Both action functions return `{ok, message?}`-shaped jsonb on the two
 *   expected refusals (not yours, too many actions this hour) rather than
 *   raising — supabase/migrations/20260808000000_teacher_action_outcomes.sql
 *   explains why: a raised exception aborts the whole RPC's transaction,
 *   which would roll back the very audit-log row recording the refusal. An
 *   unraised {ok: false} lets that row commit like anything else.
 *
 * Every function returns `{ ok: true; ... } | { ok: false; message: string }`
 * and never throws — the same contract as markSubtopicComplete() in
 * src/lib/journey.ts and saveTestAttempt() in src/lib/testAttempts.ts.
 */

import { supabase } from "@/lib/supabase";

/** A row of the teacher's list, with lock state merged in. */
export type TeacherStudent = {
  id: string;
  nickname: string;
  /** True while they're still on a PIN somebody else chose for them. */
  must_change_pin: boolean;
  /** ISO timestamp, or null when they aren't locked out. */
  locked_until: string | null;
};

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

/** What teacher_student_lockouts() returns, one row per currently-locked student. */
type LockoutRow = { student_id: string; locked_until: string };

/**
 * The teacher's students, newest information first.
 *
 * Two calls, in parallel, because they come from genuinely different places:
 * the roster from a policy-filtered table read, the lock state from a function
 * — `login_attempts` has RLS on with no policies and no grants to anyone, so
 * there is no version of this where the browser reads that table directly.
 *
 * A failed lockout lookup is NOT treated as a failure of the whole call. If it
 * breaks, every student simply appears unlocked, which is a page that is
 * slightly wrong rather than a page that won't load — and the teacher can
 * still reset a PIN, which clears a lockout anyway.
 */
export async function fetchTeacherStudents(): Promise<Result<{ students: TeacherStudent[] }>> {
  const [roster, lockouts] = await Promise.all([
    supabase.from("students").select("id, nickname, must_change_pin").order("nickname"),
    supabase.rpc("teacher_student_lockouts"),
  ]);

  if (roster.error) {
    return { ok: false, message: roster.error.message };
  }
  if (lockouts.error) {
    console.error("Could not read lockout state", lockouts.error);
  }

  const lockedUntilById = new Map<string, string>(
    ((lockouts.data ?? []) as LockoutRow[]).map((row) => [row.student_id, row.locked_until]),
  );

  const students = (roster.data ?? []).map((row) => ({
    id: row.id as string,
    nickname: row.nickname as string,
    must_change_pin: row.must_change_pin as boolean,
    locked_until: lockedUntilById.get(row.id as string) ?? null,
  }));

  return { ok: true, students };
}

/**
 * Lift a lockout immediately.
 *
 * The counter is wiped rather than the timer cleared, so the student gets a
 * full set of attempts back — being unlocked one wrong guess away from being
 * locked again would be its own small disaster in a classroom.
 */
export async function unlockStudent(studentId: string): Promise<Result<object>> {
  const { data, error } = await supabase.rpc("teacher_unlock_student", {
    p_student_id: studentId,
  });

  if (error) return { ok: false, message: readableError(error.message) };

  const result = data as { ok: boolean; message?: string };
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Something went wrong. Try again in a moment." };
  }
  return { ok: true };
}

/**
 * Reset a forgotten PIN, and return the new one.
 *
 * This is the only moment the new PIN exists in readable form anywhere — the
 * database stores a bcrypt hash of it and nothing else. If the teacher closes
 * the panel without reading it out, the remedy is another reset, not a lookup.
 *
 * The student is put back on must_change_pin, so RequireAuth funnels them
 * through /set-pin before they reach anything else. A PIN read aloud across a
 * classroom is not a secret and shouldn't be treated as one.
 */
export async function resetStudentPin(studentId: string): Promise<Result<{ pin: string }>> {
  const { data, error } = await supabase.rpc("teacher_reset_pin", {
    p_student_id: studentId,
  });

  if (error) return { ok: false, message: readableError(error.message) };

  const result = data as { ok: boolean; message?: string; pin?: string };
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Something went wrong. Try again in a moment." };
  }

  if (!result.pin) {
    // The reset almost certainly happened — the function returns its payload
    // last, after every write. Saying so matters: "it failed" would send a
    // teacher round the loop again, when what they actually need is to reset
    // once more to get a PIN they can read.
    return {
      ok: false,
      message: "The PIN was reset, but didn't come back. Reset it once more to see the new one.",
    };
  }

  return { ok: true, pin: result.pin };
}

/**
 * Turn a Postgres error into something worth showing a teacher.
 *
 * The two expected refusals (not yours, too many actions) no longer reach
 * here — teacher_unlock_student() and teacher_reset_pin() return them as
 * {ok: false, message} instead of raising (20260808000000), specifically so
 * the refusal's audit-log row survives instead of being rolled back with a
 * raised exception. So anything that does land here is a genuine surprise — a
 * dropped connection, a missing grant — and its raw text would be noise at
 * best and schema detail at worst.
 */
function readableError(message: string): string {
  console.error("Unexpected error from a teacher action", message);
  return "Something went wrong. Try again in a moment.";
}
