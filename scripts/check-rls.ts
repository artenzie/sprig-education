/**
 * Prove that row-level security still says what we think it says.
 *
 *   node --env-file=.env scripts/check-rls.ts --out baseline.json
 *   node --env-file=.env scripts/check-rls.ts --baseline baseline.json
 *
 * Written for the host role (supabase/migrations/20260818010000_host_role.sql),
 * which is the first thing in Sprig that can read across every teacher's
 * students. The question that migration has to answer is not "can the host see
 * everything" — that is easy to eyeball — but "does a NON-host teacher still
 * see exactly what they saw yesterday, and not one row more". This script
 * exists to answer that with numbers rather than confidence.
 *
 * WHY REAL SESSIONS AND NOT `set local role`.
 *
 * The obvious way to test a policy is to impersonate a role in the SQL editor:
 * set request.jwt.claims, `set local role authenticated`, run the query. That
 * tests the policy. It does NOT test the path the browser actually takes —
 * PostgREST, the grants it needs, the JWT Supabase signs, the way a missing
 * grant surfaces as 42501 rather than an empty result. So every probe below
 * signs in for real, with a real password, through the same publishable key
 * the app ships with, and asks the same questions the app asks. What passes
 * here passes for the browser too, because it IS what the browser does.
 *
 * WHAT IT CHECKS, in three layers:
 *
 *   1. VISIBILITY. Row counts, plus the actual nicknames visible, for each of
 *      the seven tables the host dashboard reads. Nicknames rather than counts
 *      alone because "3" and "3" can be three different students.
 *   2. DRIFT. With --baseline, the non-host teacher's and the student's rows
 *      are compared against a previous run and any difference at all is a
 *      failure. The pass condition for this migration was never "the numbers
 *      look small" — it is "the numbers are identical to before".
 *   3. INVARIANTS. Five things that must hold regardless of what data exists:
 *      a teacher cannot promote themselves, nobody can touch help_messages
 *      directly, a non-host cannot act on another teacher's student, a student
 *      is not a teacher, and a non-host teacher's is_host() is false.
 *
 * ---------------------------------------------------------------------------
 * BEFORE THIS WILL RUN
 * ---------------------------------------------------------------------------
 * It needs three throwaway accounts, and they DO NOT CURRENTLY EXIST. The ones
 * used to verify the host role on 19 August were deleted immediately
 * afterwards, on the principle that a pilot holding real children's data should
 * not also carry standing accounts nobody uses -- one of them had to be flagged
 * `is_host` to exercise the host side, and an idle spare host is exactly the
 * kind of thing that gets forgotten.
 *
 * So the first run after that costs three commands:
 *
 *   node --env-file=.env scripts/create-teacher.ts rls-check-host@sprig.invalid \
 *     --school "RLS Check (throwaway host)"
 *   node --env-file=.env scripts/create-teacher.ts rls-check-teacher@sprig.invalid \
 *     --school "RLS Check (throwaway non-host)"
 *   node --env-file=.env scripts/create-students.ts 2 --teacher <each id>
 *
 * Then put the two generated passwords, plus one student nickname and its
 * starter PIN, into .env as RLS_CHECK_HOST_EMAIL / _PASSWORD,
 * RLS_CHECK_TEACHER_EMAIL / _PASSWORD, RLS_CHECK_STUDENT_EMAIL / _PASSWORD --
 * the student's address is the synthetic one, `wandering-badger@students.sprig.study`.
 * Flag the host with `update teachers set is_host = true where email = '...'`,
 * and UNFLAG IT AGAIN when you are done.
 *
 * A missing account fails with "Could not sign in as the ...", which is this
 * paragraph's fault and not a policy problem.
 *
 * The three principals are throwaway accounts made for this, never real ones.
 * Their credentials live in .env (gitignored) and not in this file.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Deliberately the PUBLISHABLE key, not the service-role key.
 *
 * The service-role key bypasses RLS entirely, so a script holding it would
 * report that everything is visible to everyone and prove nothing at all. The
 * whole point is to be exactly as privileged as a browser is.
 */
const PRINCIPALS = [
  {
    key: "host",
    label: "host teacher",
    kind: "teacher" as const,
    email: process.env.RLS_CHECK_HOST_EMAIL,
    password: process.env.RLS_CHECK_HOST_PASSWORD,
  },
  {
    key: "teacher",
    label: "non-host teacher",
    kind: "teacher" as const,
    email: process.env.RLS_CHECK_TEACHER_EMAIL,
    password: process.env.RLS_CHECK_TEACHER_PASSWORD,
  },
  {
    key: "student",
    label: "student",
    kind: "student" as const,
    email: process.env.RLS_CHECK_STUDENT_EMAIL,
    password: process.env.RLS_CHECK_STUDENT_PASSWORD,
  },
];

/** The tables the host dashboard reads, and which every other role must not. */
const TABLES = [
  "students",
  "teachers",
  "progress",
  "test_attempts",
  "daily_checkins",
  "weekly_checkins",
] as const;

type Probe = {
  /** Row count, or null when the read was refused outright. */
  count: number | null;
  /** Postgres error code, when there was one. 42501 = permission denied. */
  error: string | null;
};

type PrincipalResult = {
  label: string;
  userId: string;
  isHost: boolean | string;
  tables: Record<string, Probe>;
  /** Every student nickname this principal can see, sorted. */
  studentsVisible: string[];
  /** Every teacher email this principal can see, sorted. */
  teachersVisible: string[];
  invariants: Record<string, { pass: boolean; detail: string }>;
};

async function main() {
  const args = process.argv.slice(2);
  const outPath = valueOf(args, "--out");
  const baselinePath = valueOf(args, "--baseline");

  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    fail(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.\n" +
        "Run with --env-file=.env.",
    );
  }
  for (const p of PRINCIPALS) {
    if (!p.email || !p.password) {
      fail(
        `Missing credentials for the ${p.label}.\n` +
          `Add RLS_CHECK_${p.key.toUpperCase()}_EMAIL and ` +
          `RLS_CHECK_${p.key.toUpperCase()}_PASSWORD to .env.`,
      );
    }
  }

  // Sign everyone in first, because two of the invariants need one principal
  // to act on another principal's data and therefore need both sessions open
  // at once.
  const sessions = new Map<string, { client: SupabaseClient; userId: string }>();
  for (const p of PRINCIPALS) {
    const client = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: p.email!,
      password: p.password!,
    });
    if (error || !data.user) {
      fail(`Could not sign in as the ${p.label} (${p.email}): ${error?.message}`);
    }
    sessions.set(p.key, { client, userId: data.user!.id });
  }

  // One student from each of the two teachers' classes, so that every
  // principal can be aimed at a class that is NOT its own. Pointing the host
  // at its own student would prove nothing — owning a student was always
  // allowed; the question is whether it can now reach across.
  //
  // The .eq() here is test scaffolding picking a known target, not a
  // security-relevant read, and it behaves identically before and after the
  // migration — which is why it is safe to bootstrap the run from.
  // The reset probe below is REAL and DESTRUCTIVE — it genuinely replaces a
  // PIN. So the target must never be the student principal, or the script
  // would break its own next run by changing the password it signs in with.
  // Ordered by nickname so the choice is stable rather than whatever the
  // planner returned that day.
  const studentPrincipalId = sessions.get("student")!.userId;
  const ownStudent = async (key: string) => {
    const { client, userId } = sessions.get(key)!;
    const { data } = await client
      .from("students")
      .select("id, nickname")
      .eq("teacher_id", userId)
      .order("nickname");
    const candidates = (data ?? []) as { id: string; nickname: string }[];
    return candidates.find((s) => s.id !== studentPrincipalId);
  };
  const inHostClass = await ownStudent("host");
  const inTeacherClass = await ownStudent("teacher");

  // Each principal gets the other class's student. The student principal
  // belongs to the non-host teacher, so it too is aimed at the host's class.
  const foreignFor: Record<string, typeof inHostClass> = {
    host: inTeacherClass,
    teacher: inHostClass,
    student: inHostClass,
  };

  const results: Record<string, PrincipalResult> = {};

  for (const p of PRINCIPALS) {
    const { client, userId } = sessions.get(p.key)!;
    results[p.key] = await probePrincipal(p.label, client, userId, foreignFor[p.key]);
  }

  report(results);

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
    console.log(`\nWritten to ${outPath}`);
  }

  const drifted = baselinePath ? compareToBaseline(results, baselinePath) : false;
  const failed = Object.values(results).some((r) =>
    Object.values(r.invariants).some((i) => !i.pass),
  );

  if (drifted || failed) {
    console.log("\n✗ FAILED — see above.\n");
    process.exitCode = 1;
  } else {
    console.log("\n✓ All checks passed.\n");
  }
}

async function probePrincipal(
  label: string,
  client: SupabaseClient,
  userId: string,
  foreignStudent: { id: string; nickname: string } | undefined,
): Promise<PrincipalResult> {
  const tables: Record<string, Probe> = {};

  for (const table of TABLES) {
    // head + exact count asks PostgREST for the count only. It is not subject
    // to the 1000-row response cap, so it stays honest on a table with
    // thousands of rows — which `progress` will have.
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });
    tables[table] = { count: count ?? null, error: error?.code ?? null };
  }

  // The nickname list matters more than the count. Two runs can both say "3"
  // and mean different students; two identical sorted lists cannot.
  const { data: studentRows } = await client.from("students").select("nickname");
  const studentsVisible = ((studentRows ?? []) as { nickname: string }[])
    .map((r) => r.nickname)
    .sort();

  const { data: teacherRows } = await client.from("teachers").select("email");
  const teachersVisible = ((teacherRows ?? []) as { email: string }[])
    .map((r) => r.email)
    .sort();

  // ---------------------------------------------------------------------
  // is_host()
  // ---------------------------------------------------------------------
  // Absent before the migration, which is not a failure — it is what "before"
  // looks like. Recorded as the error code so the baseline file is still a
  // faithful record of that moment.
  const hostRpc = await client.rpc("is_host");
  const isHost: boolean | string = hostRpc.error
    ? `(${hostRpc.error.code ?? "error"})`
    : Boolean(hostRpc.data);

  const invariants: Record<string, { pass: boolean; detail: string }> = {};

  // ---------------------------------------------------------------------
  // D. Can this principal promote itself to host?
  // ---------------------------------------------------------------------
  // The single most important check in this file. `is_host` is only ever
  // meaningful if the people it excludes cannot set it on themselves. There is
  // no UPDATE grant on `teachers` for `authenticated` — this is the run that
  // turns that from a claim into a fact.
  const selfPromote = await client
    .from("teachers")
    .update({ is_host: true })
    .eq("id", userId)
    .select();
  invariants["cannot self-promote to host"] = {
    // A silent success (no error, no rows) would be a pass on rows but a fail
    // on intent, so an empty non-error result is treated as a failure too:
    // the write must be REFUSED, not merely ineffective.
    pass: Boolean(selfPromote.error),
    detail: selfPromote.error
      ? `refused (${selfPromote.error.code})`
      : `NOT REFUSED — updated ${selfPromote.data?.length ?? 0} row(s)`,
  };

  // The same question with the column taken out of it.
  //
  // Worth its own probe because of how the check above fails BEFORE the
  // migration: PostgREST answers "no such column" (PGRST204) rather than
  // "permission denied", so on that run it proves the column is absent and
  // says nothing at all about the grant. Writing to a column that has existed
  // since July separates the two — if this is refused, `teachers` is closed to
  // writes generally, and is_host is protected by that and not by obscurity.
  const selfUpdateExisting = await client
    .from("teachers")
    .update({ school_name: "escalation probe" })
    .eq("id", userId)
    .select();
  invariants["cannot write to own teacher row"] = {
    pass: Boolean(selfUpdateExisting.error),
    detail: selfUpdateExisting.error
      ? `refused (${selfUpdateExisting.error.code})`
      : `NOT REFUSED — updated ${selfUpdateExisting.data?.length ?? 0} row(s)`,
  };

  // The same question from the other direction: inserting a brand new teacher
  // row for yourself, flagged host.
  const selfInsert = await client
    .from("teachers")
    .insert({ id: userId, email: `escalation-${userId}@sprig.invalid`, is_host: true })
    .select();
  invariants["cannot insert a host teacher row"] = {
    pass: Boolean(selfInsert.error),
    detail: selfInsert.error
      ? `refused (${selfInsert.error.code})`
      : `NOT REFUSED — inserted ${selfInsert.data?.length ?? 0} row(s)`,
  };

  // ---------------------------------------------------------------------
  // E. help_messages stays unreachable from any browser
  // ---------------------------------------------------------------------
  // RLS on, zero policies, zero grants — 20260817000000 made that table
  // deliberately unreadable by every role including teachers, and the host
  // work must not have quietly widened it. The host reads it through
  // host_help_messages() instead, which is checked separately below.
  const helpDirect = await client.from("help_messages").select("id").limit(1);
  invariants["cannot read help_messages directly"] = {
    pass: Boolean(helpDirect.error),
    detail: helpDirect.error
      ? `refused (${helpDirect.error.code})`
      : `NOT REFUSED — read ${helpDirect.data?.length ?? 0} row(s)`,
  };

  // ---------------------------------------------------------------------
  // C. Acting on somebody else's student
  // ---------------------------------------------------------------------
  // A reset is a real, destructive action, so this probe deliberately aims it
  // at a student in a class the principal does not own. If the guard works the
  // student is untouched; if it does not, this check fails loudly and the
  // account it reset is a throwaway.
  //
  // The expectation is read from is_host() rather than hardcoded per
  // principal, so the same script is correct on both sides of the migration:
  // before it, nobody is a host and every one of these must be refused.
  if (foreignStudent) {
    const reset = await client.rpc("teacher_reset_pin", { p_student_id: foreignStudent.id });
    const payload = reset.data as { ok?: boolean; message?: string } | null;
    const allowed = !reset.error && payload?.ok === true;
    invariants["reset PIN on another class"] = {
      pass: isHost === true ? allowed : !allowed,
      detail: reset.error
        ? `raised (${reset.error.code})`
        : allowed
          ? `allowed — reset ${foreignStudent.nickname}`
          : `refused — ${payload?.message ?? "no message"}`,
    };
  }

  return { label, userId, isHost, tables, studentsVisible, teachersVisible, invariants };
}

function report(results: Record<string, PrincipalResult>) {
  const keys = Object.keys(results);

  console.log("\nVISIBLE ROWS\n");
  const header = ["", ...keys.map((k) => results[k].label)];
  const rows = [
    ["is_host()", ...keys.map((k) => String(results[k].isHost))],
    ...TABLES.map((t) => [
      t,
      ...keys.map((k) => {
        const probe = results[k].tables[t];
        return probe.error ? `refused (${probe.error})` : String(probe.count);
      }),
    ]),
  ];
  printTable(header, rows);

  console.log("\nSTUDENTS VISIBLE\n");
  for (const k of keys) {
    const list = results[k].studentsVisible;
    console.log(`  ${results[k].label.padEnd(18)} ${list.length ? list.join(", ") : "(none)"}`);
  }

  console.log("\nTEACHERS VISIBLE\n");
  for (const k of keys) {
    const list = results[k].teachersVisible;
    console.log(`  ${results[k].label.padEnd(18)} ${list.length ? list.join(", ") : "(none)"}`);
  }

  console.log("\nINVARIANTS\n");
  for (const k of keys) {
    console.log(`  ${results[k].label}`);
    for (const [name, result] of Object.entries(results[k].invariants)) {
      console.log(`    ${result.pass ? "✓" : "✗"} ${name.padEnd(34)} ${result.detail}`);
    }
  }
}

/**
 * The drift check — step B, and the reason this script writes a file at all.
 *
 * Only the non-host teacher and the student are compared. The host is EXPECTED
 * to differ after the migration; that is the feature. Everyone else differing
 * is the bug the whole exercise is guarding against.
 */
function compareToBaseline(results: Record<string, PrincipalResult>, path: string): boolean {
  const baseline = JSON.parse(readFileSync(path, "utf8")) as Record<string, PrincipalResult>;
  let drifted = false;

  console.log(`\nDRIFT vs ${path}  (non-host principals only — the host is expected to widen)\n`);

  for (const key of ["teacher", "student"]) {
    const before = baseline[key];
    const after = results[key];
    if (!before) {
      console.log(`  ? ${key} — not in the baseline, nothing to compare`);
      continue;
    }

    const problems: string[] = [];

    for (const table of TABLES) {
      const b = before.tables[table];
      const a = after.tables[table];
      if (b.count !== a.count || b.error !== a.error) {
        problems.push(
          `${table}: ${describeProbe(b)} → ${describeProbe(a)}`,
        );
      }
    }
    if (before.studentsVisible.join("|") !== after.studentsVisible.join("|")) {
      problems.push(
        `students visible: [${before.studentsVisible.join(", ")}] → [${after.studentsVisible.join(", ")}]`,
      );
    }
    if (before.teachersVisible.join("|") !== after.teachersVisible.join("|")) {
      problems.push(
        `teachers visible: [${before.teachersVisible.join(", ")}] → [${after.teachersVisible.join(", ")}]`,
      );
    }

    if (problems.length === 0) {
      console.log(`  ✓ ${after.label.padEnd(18)} identical to the baseline`);
    } else {
      drifted = true;
      console.log(`  ✗ ${after.label.padEnd(18)} CHANGED:`);
      for (const p of problems) console.log(`      ${p}`);
    }
  }

  return drifted;
}

function describeProbe(p: Probe): string {
  return p.error ? `refused (${p.error})` : String(p.count);
}

function printTable(header: string[], rows: string[][]) {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const line = (cells: string[]) =>
    "  " + cells.map((c, i) => (c ?? "").padEnd(widths[i])).join("   ");
  console.log(line(header));
  console.log("  " + widths.map((w) => "-".repeat(w)).join("   "));
  for (const r of rows) console.log(line(r));
}

function valueOf(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
