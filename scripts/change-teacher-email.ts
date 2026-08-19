/**
 * Change a teacher's login email.
 *
 *   node --env-file=.env scripts/change-teacher-email.ts old@school.uk new@example.com
 *   node --env-file=.env scripts/change-teacher-email.ts old@school.uk new@example.com --dry-run
 *
 * The third sibling of create-teacher.ts and create-students.ts, and a script
 * for the same reason as both: it needs the service-role key, which bypasses
 * RLS entirely and can therefore never go anywhere near a browser.
 *
 * WHY THIS IS NOT A ONE-LINER. A teacher is two rows that must agree — one in
 * auth.users holding the credentials, one in public.teachers holding who they
 * are in Sprig — and the email is stored in BOTH. Changing only one produces a
 * failure that is genuinely confusing to diagnose:
 *
 *   - auth.users only: they log in with the new address, and every screen in
 *     the app keeps showing the old one, because that is what the profile row
 *     says.
 *   - public.teachers only: the app shows the new address, and signing in with
 *     it fails, because GoTrue still wants the old one.
 *
 * So both are updated, in that order, and the auth change is rolled back if the
 * profile update fails. Same rollback shape create-teacher.ts uses when its
 * profile insert fails.
 *
 * WHAT THIS DOES NOT CHANGE:
 *
 *   - The password. It is untouched, and unreadable anyway.
 *   - The teacher's id. Which means `is_host`, their students (via
 *     students.teacher_id), and every row in teacher_actions follow the account
 *     across the rename automatically — all of those key on the id, never on
 *     the email.
 *   - Live sessions. Changing an email does not invalidate a session issued
 *     before it, so anyone already signed in stays signed in.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [currentEmail, newEmail] = args.filter((a) => !a.startsWith("--"));

  if (!currentEmail || !newEmail || !currentEmail.includes("@") || !newEmail.includes("@")) {
    fail(
      "Usage: node --env-file=.env scripts/change-teacher-email.ts <current-email> <new-email> [--dry-run]",
    );
  }
  if (currentEmail === newEmail) {
    fail("Those are the same address — nothing to do.");
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    fail(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add both to .env and run with --env-file=.env.\n" +
        "Do NOT prefix them with VITE_ — that would inline the service-role key into the browser bundle.",
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: teacher, error: lookupError } = await admin
    .from("teachers")
    .select("id, email, school_name, is_host")
    .eq("email", currentEmail)
    .maybeSingle();

  if (lookupError) fail(`Could not read the teachers table: ${lookupError.message}`);
  if (!teacher) fail(`No teacher has the email ${currentEmail}.`);

  // teachers.email is UNIQUE, so this would fail on the constraint anyway —
  // but failing here means failing BEFORE the auth user has been touched,
  // rather than relying on the rollback to undo a change that never needed
  // making.
  const { data: clash } = await admin
    .from("teachers")
    .select("id")
    .eq("email", newEmail)
    .maybeSingle();
  if (clash) fail(`Another teacher already uses ${newEmail} (id ${clash.id}).`);

  console.log(`\n  Teacher   ${teacher.email}`);
  console.log(`  School    ${teacher.school_name ?? "(none)"}`);
  console.log(`  Host      ${teacher.is_host ? "yes" : "no"}`);
  console.log(`  ID        ${teacher.id}`);
  console.log(`\n  New email ${newEmail}\n`);

  if (dryRun) {
    console.log("Dry run — nothing was written.\n");
    return;
  }

  // email_confirm: true marks the new address confirmed on the spot. Email
  // confirmations are off project-wide, but if "secure email change" is ever
  // turned on, without this the account would sit in a pending state and the
  // teacher could not sign in with either address.
  const { error: authError } = await admin.auth.admin.updateUserById(teacher.id, {
    email: newEmail,
    email_confirm: true,
  });
  if (authError) fail(`Auth user not updated, nothing changed: ${authError.message}`);

  const { error: rowError } = await admin
    .from("teachers")
    .update({ email: newEmail })
    .eq("id", teacher.id);

  if (rowError) {
    // Put the credential back, or we leave a teacher whose login address and
    // profile address disagree — the exact half-changed state this script
    // exists to avoid.
    const { error: revertError } = await admin.auth.admin.updateUserById(teacher.id, {
      email: currentEmail,
      email_confirm: true,
    });
    fail(
      `Profile row failed: ${rowError.message}\n` +
        (revertError
          ? `AND THE ROLLBACK ALSO FAILED: ${revertError.message}\n` +
            `The account now logs in as ${newEmail} but its profile says ${currentEmail}. Fix by hand.`
          : "Auth user reverted — nothing changed."),
    );
  }

  console.log(`✓ Email changed to ${newEmail}.\n`);
  console.log(
    `The password is unchanged, and so is the account's id — so ${
      teacher.is_host ? "host access, " : ""
    }their students and their action history all follow the account across.\n\n` +
      `Sign in once with the new address to confirm before closing anything.\n`,
  );
}

class ScriptError extends Error {}

function fail(message: string): never {
  throw new ScriptError(message);
}

main().catch((error) => {
  console.error(`\n${error instanceof ScriptError ? error.message : error}\n`);
  process.exit(1);
});
