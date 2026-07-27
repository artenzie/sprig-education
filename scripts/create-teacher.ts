/**
 * Create a teacher account.
 *
 *   node --env-file=.env scripts/create-teacher.ts ms.bennett@school.uk --school "a partner school"
 *   node --env-file=.env scripts/create-teacher.ts ms.bennett@school.uk --school "..." --dry-run
 *
 * The sibling of scripts/create-students.ts, and a script for the same two
 * reasons:
 *
 *   1. Creating a user requires Supabase's admin API, which requires the
 *      service-role key. That key bypasses RLS entirely, so it can never go
 *      anywhere near the browser.
 *   2. A teacher is really two rows that must agree — one in auth.users (the
 *      credentials) and one in public.teachers (who they are in Sprig),
 *      sharing an id. Creating them together, with a rollback if the second
 *      fails, keeps that invariant intact.
 *
 * There is a third reason here that doesn't apply to students: THERE IS NO
 * SIGNUP. New-user signups are off project-wide in the Supabase dashboard, and
 * turning them on so teachers could register themselves would also re-open
 * self-registration to anyone who found the endpoint — with no way to tell a
 * real teacher from a stranger who wants a look at a class. During the pilot,
 * teacher accounts are made here, by hand, by someone who already has the
 * service-role key.
 *
 * Note this file imports nothing from src/. studentAuth.ts is safe for
 * create-students.ts to import because it deliberately has no dependencies;
 * src/lib/teacherAuth.ts is not, because it pulls in the browser Supabase
 * client and import.meta.env. Nothing here needs sharing anyway — a teacher's
 * email is a real email, typed as-is, with none of the nickname-to-address
 * bridging students require.
 */

import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Length of the generated password.
 *
 * The password is generated rather than chosen, and that is the point. Supabase
 * enforces one project-wide minimum password length, and ours is 6 because
 * student PINs are six digits (see PIN_LENGTH in src/lib/studentAuth.ts for
 * why it can't be four). So nothing in the platform would stop a teacher from
 * setting their password to "123456" — the same six characters a student is
 * explicitly forbidden from using. Generating it removes the choice, and 24
 * characters from the alphabet below is far beyond anything worth guessing.
 */
const PASSWORD_LENGTH = 24;

/**
 * Deliberately missing: O, 0, I, l, 1. A teacher reads this off a screen and
 * types it into a different device at least once, and every one of those
 * characters is a support conversation waiting to happen.
 */
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const schoolName = valueOf(args, "--school");
  // The first bare argument — anything not a flag and not a flag's value.
  const email = positional(args);

  if (!email || !email.includes("@")) {
    fail(
      'Usage: node --env-file=.env scripts/create-teacher.ts <email> [--school "Name"] [--dry-run]',
    );
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

  // Fail before creating an auth user rather than after. Without this check the
  // auth user is created, the profile insert trips the unique constraint on
  // teachers.email, and we're relying on the rollback below to clean up
  // something that never needed creating.
  const { data: existing, error: existingError } = await admin
    .from("teachers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    fail(
      `Could not read the teachers table: ${existingError.message}\n\n` +
        "If this says \"permission denied for table teachers\", the migration\n" +
        "supabase/migrations/20260727000000_teacher_accounts.sql hasn't been run yet —\n" +
        "it's the one that grants service_role access to this table.",
    );
  }
  if (existing) {
    fail(`A teacher already exists with the email ${email} (id ${existing.id}).`);
  }

  const password = generatePassword();

  if (dryRun) {
    console.log(`\nWould create a teacher:\n`);
    console.log(`  Email   ${email}`);
    console.log(`  School  ${schoolName ?? "(none)"}`);
    console.log(`\nDry run — nothing was written.\n`);
    return;
  }

  // email_confirm: true creates the account already confirmed. Email
  // confirmations are off project-wide, but being explicit means this still
  // works if that setting is ever turned back on for real addresses.
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { school_name: schoolName ?? null },
  });

  if (userError || !user?.user) {
    fail(`Auth user could not be created: ${userError?.message ?? "unknown error"}`);
  }

  const { error: rowError } = await admin.from("teachers").insert({
    id: user.user.id,
    email,
    school_name: schoolName ?? null,
  });

  if (rowError) {
    // Roll back, or we leave an auth user with no profile — which shows up
    // later as a teacher who can sign in and lands on the "Something's
    // missing" screen with no way to explain it.
    await admin.auth.admin.deleteUser(user.user.id);
    fail(`Profile row failed, auth user removed: ${rowError.message}`);
  }

  console.log(`\n✓ Teacher created.\n`);
  console.log(`  Email     ${email}`);
  console.log(`  School    ${schoolName ?? "(none)"}`);
  console.log(`  Password  ${password}`);
  console.log(`  ID        ${user.user.id}`);
  console.log(
    `\nThat password is shown once and is not stored anywhere readable —\n` +
      `Supabase has only a bcrypt hash of it. If it's lost, delete the account\n` +
      `and make another.\n\n` +
      `Next, create students that belong to this teacher:\n\n` +
      `  node --env-file=.env scripts/create-students.ts 30 --teacher ${user.user.id}\n`,
  );
}

/**
 * A password from a cryptographically secure source.
 *
 * randomInt() rather than Math.random(): Math.random() is a fast PRNG with no
 * security guarantees at all, and this is the credential guarding a whole
 * class's accounts. randomInt() is also rejection-sampled internally, so there
 * is no modulo bias across the alphabet.
 */
function generatePassword(): string {
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

/** The first argument that is neither a flag nor the value belonging to one. */
function positional(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      // --school takes a value; --dry-run doesn't. Skip the value so it can't
      // be mistaken for the email.
      if (arg === "--school") i += 1;
      continue;
    }
    return arg;
  }
  return undefined;
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
