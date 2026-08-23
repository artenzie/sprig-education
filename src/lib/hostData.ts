/**
 * Every read the host dashboard makes.
 *
 * The teacher equivalents of this file — teacherAuth.ts and teacherProgress.ts
 * — make a point of never filtering by teacher_id, because the RLS policy
 * already does it and a second copy in the query would make the safety look
 * like it came from the client. The same applies here and matters more: there
 * is no `.eq()` anywhere below, and there is nothing to filter BY. A host's
 * queries are unqualified reads of whole tables, and what comes back is
 * decided entirely by `public.is_host()` inside six policies.
 *
 * Which means the honest way to read this file is: if the migration were
 * reverted, every function here would return empty, and nothing would break
 * except the page being blank. The client cannot widen itself.
 *
 * ---------------------------------------------------------------------------
 * THE 1000-ROW TRAP
 * ---------------------------------------------------------------------------
 * PostgREST caps a response at 1000 rows by default, and it does it SILENTLY —
 * no error, no flag, just a shorter array than you asked for. Nothing in Sprig
 * has hit that before because every previous read was scoped to one student or
 * one class of thirty. A host reads the whole cohort: ~90 students against ~70
 * subtopics is up to ~6,300 progress rows, well past the cap.
 *
 * The failure that would cause is the worst kind. Not a crash — a dashboard
 * that loads perfectly and quietly reports that the cohort is 16% complete
 * when it is 60% complete, with no visible sign anything went wrong. So every
 * table read here goes through fetchAll(), which pages until the database
 * stops giving it rows.
 */

import { supabase } from "@/lib/supabase";
import type { RawTopic } from "@/lib/journey";
import type { TestAttemptRow } from "@/lib/testAttempts";

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

/** A student as the host sees them — the roster row, plus who teaches them. */
export type HostStudent = {
  id: string;
  nickname: string;
  current_tier: number;
  /** Null for students created before teacher accounts existed. Shown as unassigned. */
  teacher_id: string | null;
  must_change_pin: boolean;
  locked_until: string | null;
};

export type HostTeacher = {
  id: string;
  email: string;
  school_name: string | null;
  is_host: boolean;
};

export type HostDailyCheckin = {
  student_id: string;
  date: string;
  mood: "sad" | "meh" | "happy";
  note: string | null;
};

export type HostWeeklyCheckin = {
  student_id: string;
  week: string;
  confidence: number | null;
  completion: number | null;
  confused_by: string | null;
  liked_most: string | null;
};

export type HostHelpMessage = {
  id: number;
  created_at: string;
  message: string;
  /** Null when the sender wasn't signed in, or has since been deleted. */
  nickname: string | null;
};

/**
 * Somebody who left an email address on /login.
 *
 * No nickname and no student link, unlike HostHelpMessage: whoever fills that
 * form in has no account, which is the reason they are filling it in. The
 * address is the identity.
 */
export type HostContactRequest = {
  id: number;
  created_at: string;
  email: string;
  /** Optional — the form takes an address on its own. */
  message: string | null;
};

/** A test attempt with the student attached — the cohort view of TestAttemptRow. */
export type HostTestAttempt = TestAttemptRow & { student_id: string };

export type HostData = {
  students: HostStudent[];
  teachers: HostTeacher[];
  topics: RawTopic[];
  /** subtopic ids completed, keyed by student id. */
  progressByStudentId: Map<string, Set<string>>;
  daily: HostDailyCheckin[];
  weekly: HostWeeklyCheckin[];
  attempts: HostTestAttempt[];
  helpMessages: HostHelpMessage[];
  contactRequests: HostContactRequest[];
};

const PAGE_SIZE = 1000;

/**
 * Read a whole table, however many rows that is.
 *
 * `.range(from, to)` is inclusive at both ends, so a full page comes back as
 * exactly PAGE_SIZE rows and that is the signal to ask for another. Stopping
 * on a SHORT page rather than on an empty one saves a round trip in the common
 * case and is the only way to tell "that's all of them" from "that's the cap"
 * — which is the whole bug this exists to avoid.
 *
 * A fresh builder per page, because a PostgREST query builder is single-use:
 * calling .range() on one that has already been awaited mutates and re-sends
 * it rather than producing a second query.
 *
 * `orderBy` IS NOT OPTIONAL, and is the second half of the same bug. A range
 * request without an ORDER BY asks the database for "rows 1000-1999" of a set
 * whose order Postgres never promised — it is free to return them differently
 * on each query, and under concurrent writes it routinely does. Pages would
 * then overlap and leave gaps: a few rows counted twice, a few never seen, and
 * a completion percentage that is quietly wrong in a way no error would ever
 * reveal. Every caller passes the table's primary key, which is unique and
 * therefore a total order.
 */
async function fetchTable<T>(
  table: string,
  columns: string,
  orderBy: string[],
): Promise<Result<{ rows: T[] }>> {
  const rows: T[] = [];

  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE;
    let query = supabase.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) return { ok: false, message: error.message };

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { ok: true, rows };

    // A cohort large enough to need more pages than this is a cohort that
    // needs SQL aggregation rather than a browser doing the arithmetic. Bail
    // loudly instead of looping forever on a mistake.
    if (page > 200) {
      return { ok: false, message: "Too much data to load in the browser. This needs a SQL view." };
    }
  }
}

/**
 * Everything, in parallel.
 *
 * One call rather than six, because the page has nothing useful to show until
 * most of it has arrived — a completion figure computed from a roster that
 * hasn't loaded is worse than a spinner. The exception is deliberate: a
 * failure of any single read fails the whole thing, rather than leaving five
 * sections right and one silently wrong.
 */
export async function fetchHostData(): Promise<Result<{ data: HostData }>> {
  const [
    students,
    teachers,
    topics,
    progress,
    daily,
    weekly,
    attempts,
    lockouts,
    help,
    contact,
  ] = await Promise.all([
    // Each orderBy is the table's primary key — see the note on fetchTable
    // about why a paged read without a total order is a silent data bug.
    fetchTable<HostStudent>(
      "students",
      "id, nickname, current_tier, teacher_id, must_change_pin",
      ["id"],
    ),
    fetchTable<HostTeacher>("teachers", "id, email, school_name, is_host", ["id"]),
    fetchTable<RawTopic>("topics", "id,tier,order,title,subtopics(id,order,title)", ["id"]),
    fetchTable<{ student_id: string; subtopic_id: string; status: string }>(
      "progress",
      "student_id, subtopic_id, status",
      ["student_id", "subtopic_id"],
    ),
    fetchTable<HostDailyCheckin>("daily_checkins", "student_id, date, mood, note", [
      "student_id",
      "date",
    ]),
    fetchTable<HostWeeklyCheckin>(
      "weekly_checkins",
      "student_id, week, confidence, completion, confused_by, liked_most",
      ["student_id", "week"],
    ),
    fetchTable<HostTestAttempt>(
      "test_attempts",
      "id, student_id, test_type, score, date, questions_shown, answers",
      ["id"],
    ),
    supabase.rpc("teacher_student_lockouts"),
    supabase.rpc("host_help_messages"),
    supabase.rpc("host_contact_requests"),
  ]);

  for (const result of [students, teachers, topics, progress, daily, weekly, attempts]) {
    if (!result.ok) return { ok: false, message: result.message };
  }
  // Both of these are non-fatal on purpose, exactly as the lockout read is in
  // fetchTeacherStudents(): a dashboard missing its lock badges or its inbox
  // is slightly wrong, while a dashboard that refuses to load is useless.
  if (lockouts.error) console.error("Could not read lockout state", lockouts.error);
  if (help.error) console.error("Could not read the feedback inbox", help.error);
  if (contact.error) console.error("Could not read contact requests", contact.error);

  const lockedUntilById = new Map<string, string>(
    ((lockouts.data ?? []) as { student_id: string; locked_until: string }[]).map((r) => [
      r.student_id,
      r.locked_until,
    ]),
  );

  const progressByStudentId = new Map<string, Set<string>>();
  for (const row of (progress as { ok: true; rows: { student_id: string; subtopic_id: string; status: string }[] }).rows) {
    // Filtered here rather than with .eq("status", "complete") so that paging
    // stays a plain whole-table read. `progress` only ever holds completions
    // anyway — journey.ts writes nothing else — so this drops nothing today
    // and keeps doing the right thing if that ever changes.
    if (row.status !== "complete") continue;
    const set = progressByStudentId.get(row.student_id) ?? new Set<string>();
    set.add(row.subtopic_id);
    progressByStudentId.set(row.student_id, set);
  }

  const roster = (students as { ok: true; rows: HostStudent[] }).rows
    .map((s) => ({ ...s, locked_until: lockedUntilById.get(s.id) ?? null }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  return {
    ok: true,
    data: {
      students: roster,
      teachers: (teachers as { ok: true; rows: HostTeacher[] }).rows,
      topics: (topics as { ok: true; rows: RawTopic[] }).rows,
      progressByStudentId,
      daily: (daily as { ok: true; rows: HostDailyCheckin[] }).rows,
      weekly: (weekly as { ok: true; rows: HostWeeklyCheckin[] }).rows,
      attempts: (attempts as { ok: true; rows: HostTestAttempt[] }).rows,
      helpMessages: (help.data ?? []) as HostHelpMessage[],
      contactRequests: (contact.data ?? []) as HostContactRequest[],
    },
  };
}
