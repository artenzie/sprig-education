/**
 * Create anonymous student accounts.
 *
 *   node --env-file=.env scripts/create-students.ts 30
 *   node --env-file=.env scripts/create-students.ts 30 --dry-run
 *   node --env-file=.env scripts/create-students.ts 30 --teacher <uuid>
 *
 * Run locally, never deployed. Two reasons it has to be a script rather than a
 * page in the app:
 *
 *   1. Creating a user requires Supabase's admin API, which requires the
 *      service-role key. That key bypasses RLS entirely, so it can never go
 *      anywhere near the browser.
 *   2. Each student is really two rows that must agree — one in auth.users
 *      (the credentials) and one in public.students (who they are in Sprig),
 *      sharing an id. Creating them together, with a rollback if the second
 *      fails, keeps that invariant intact.
 *
 * Every account is created on the shared starter PIN and flagged
 * must_change_pin, so the first thing a student does is replace it.
 *
 * Node runs this .ts file directly (type stripping, built in since Node 23) —
 * no build step, no ts-node. Note the consequence: `npm run build` does NOT
 * typecheck this file, because tsconfig.app.json only includes `src`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
// The .ts extension is required — Node resolves ESM specifiers literally.
// studentAuth.ts deliberately imports nothing, so pulling it in here doesn't
// drag in the browser Supabase client or import.meta.env.
import { DEFAULT_PIN, nicknameToEmail, nicknameToSlug } from "../src/lib/studentAuth.ts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Nickname vocabulary. Woodland and botanical, matching the existing
 * "Curious Squirrel" voice — 24 x 24 gives 576 combinations, plenty for a
 * pilot and small enough that no two nicknames in a class read alike.
 */
const ADJECTIVES = [
  "Curious", "Quiet", "Bright", "Patient", "Clever", "Gentle",
  "Steady", "Bold", "Kindly", "Nimble", "Thoughtful", "Sunny",
  "Watchful", "Cheerful", "Careful", "Eager", "Merry", "Restless",
  "Wandering", "Hopeful", "Earnest", "Frosty", "Amber", "Dusky",
];

const ANIMALS = [
  "Squirrel", "Badger", "Heron", "Otter", "Wren", "Hedgehog",
  "Kestrel", "Fox", "Dormouse", "Robin", "Stoat", "Finch",
  "Marten", "Owl", "Hare", "Newt", "Swift", "Vole",
  "Lapwing", "Weasel", "Thrush", "Pipit", "Shrew", "Curlew",
];

type Created = { nickname: string; email: string; pin: string };

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const teacherId = valueOf(args, "--teacher");
  const count = Number(args.find((arg) => /^\d+$/.test(arg)));

  if (!count || count < 1) {
    fail("Usage: node --env-file=.env scripts/create-students.ts <count> [--teacher <uuid>] [--dry-run]");
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    fail(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add both to .env (see .env.example) and run with --env-file=.env.\n" +
        "Do NOT prefix them with VITE_ — that would inline the service-role key into the browser bundle.",
    );
  }

  // persistSession: false — a script has nowhere to persist a session to, and
  // the service-role key is not a session anyway.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: existingError } = await admin.from("students").select("nickname");
  if (existingError) {
    fail(`Could not read existing students: ${existingError.message}`);
  }

  const taken = new Set((existing ?? []).map((row) => nicknameToSlug(row.nickname)));
  const nicknames = pickNicknames(count, taken);

  console.log(`\n${dryRun ? "Would create" : "Creating"} ${nicknames.length} student${nicknames.length === 1 ? "" : "s"}:\n`);

  if (dryRun) {
    for (const nickname of nicknames) {
      console.log(`  ${nickname.padEnd(24)} ${nicknameToEmail(nickname)}`);
    }
    console.log("\nDry run — nothing was written.\n");
    return;
  }

  const created: Created[] = [];

  for (const nickname of nicknames) {
    const email = nicknameToEmail(nickname);

    // email_confirm: true creates the account already confirmed, so Supabase
    // never tries to send mail to an address that cannot receive it.
    const { data: user, error: userError } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_PIN,
      email_confirm: true,
      user_metadata: { nickname },
    });

    if (userError || !user?.user) {
      console.error(`  ✗ ${nickname.padEnd(24)} auth user failed: ${userError?.message ?? "unknown error"}`);
      continue;
    }

    const { error: rowError } = await admin.from("students").insert({
      id: user.user.id,
      nickname,
      teacher_id: teacherId ?? null,
      must_change_pin: true,
    });

    if (rowError) {
      // Roll back, or we leave an auth user with no profile — which shows up
      // later as a student who can log in but has nowhere to land.
      await admin.auth.admin.deleteUser(user.user.id);
      console.error(`  ✗ ${nickname.padEnd(24)} profile failed, auth user removed: ${rowError.message}`);
      continue;
    }

    created.push({ nickname, email, pin: DEFAULT_PIN });
    console.log(`  ✓ ${nickname.padEnd(24)} PIN ${DEFAULT_PIN}`);
  }

  if (created.length === 0) {
    fail("\nNo students were created.");
  }

  // The PIN is written as ="000000" rather than 000000. Excel type-infers every
  // CSV field, and plain 000000 -- or even "000000", since Excel strips the
  // quotes before inferring -- lands in the sheet as the number 0. A teacher
  // would print a hand-out reading 0 next to every name. The ="..." form is
  // Excel's escape hatch for "this is text, leave it alone", and Google Sheets
  // and LibreOffice honour it too. Anything reading the file programmatically
  // sees the literal ="000000", so parse accordingly if that ever matters.
  const path = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  const rows = ["nickname,starter_pin", ...created.map((s) => `"${s.nickname}",="${s.pin}"`)];
  writeFileSync(appendSuffixIfExists(path), rows.join("\n") + "\n", "utf8");

  console.log(
    `\n${created.length} student${created.length === 1 ? "" : "s"} created. Hand-out list written to ${path}.\n` +
      `Everyone starts on PIN ${DEFAULT_PIN} and must change it at first login.\n` +
      `That file is gitignored — delete it once the PINs have been distributed.\n`,
  );
}

/** Distinct nicknames that don't collide with anything already in the table. */
function pickNicknames(count: number, taken: Set<string>): string[] {
  const pool: string[] = [];
  for (const adjective of ADJECTIVES) {
    for (const animal of ANIMALS) {
      const nickname = `${adjective} ${animal}`;
      if (!taken.has(nicknameToSlug(nickname))) pool.push(nickname);
    }
  }

  if (pool.length < count) {
    fail(`Only ${pool.length} unused nicknames left, but ${count} were asked for. Widen the word lists.`);
  }

  // Fisher-Yates, so a class doesn't get every "Curious ..." in a row.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Never silently overwrite a hand-out list from earlier the same day. */
function appendSuffixIfExists(path: string): string {
  let candidate = path;
  let n = 2;
  while (exists(candidate)) {
    candidate = path.replace(/\.csv$/, `-${n}.csv`);
    n += 1;
  }
  return candidate;
}

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

function valueOf(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

/** An error we produced deliberately, as opposed to one that surprised us. */
class ScriptError extends Error {}

/**
 * Bail out with a message.
 *
 * Throws rather than calling process.exit(). On Windows, process.exit() while
 * supabase-js still has open sockets crashes libuv with
 * "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)", which buries the
 * actual error under a native stack trace. Throwing lets the handler below
 * print the message and set an exit code once the event loop has drained.
 */
function fail(message: string): never {
  throw new ScriptError(message);
}

try {
  await main();
} catch (error) {
  // Expected failures get their message; anything else keeps its stack, which
  // is what you actually want when something unforeseen breaks.
  console.error(error instanceof ScriptError ? error.message : error);
  process.exitCode = 1;
}
