/**
 * Set a teacher's (or the host's) password to one you type yourself.
 *
 *   node --env-file=.env scripts/set-host-password.ts you@example.com
 *   node --env-file=.env scripts/set-host-password.ts you@example.com --dry-run
 *
 * The fourth sibling of create-teacher.ts, create-students.ts and
 * change-teacher-email.ts, and a script for the same reason as all three: it
 * needs the service-role key, which bypasses RLS entirely and can therefore
 * never go anywhere near a browser.
 *
 * WHY THIS EXISTS WHEN create-teacher.ts ALREADY GENERATES A PASSWORD.
 *
 * create-teacher.ts *invents* a 24-character password and prints it once. That
 * is the right default for handing an account to someone else -- nobody has to
 * choose a password, and nobody can choose a bad one. It is the wrong tool for
 * rotating your own, for two reasons:
 *
 *   1. You may want a password you can actually remember, or one that already
 *      lives in your password manager. A generated string forces a copy-paste
 *      round trip through whatever terminal scrollback happens to be open.
 *   2. A generated password has to be DISPLAYED to be useful. This script's
 *      whole point is that the password is never displayed, never passed as an
 *      argument, and never written to a file -- so it cannot be read out of
 *      shell history (`node ... --password hunter2` would sit in .bash_history
 *      forever), out of a scrollback buffer, or out of the process table, where
 *      argv is world-readable on most systems.
 *
 * HOW THE INPUT IS HIDDEN. Node has no built-in getpass. Reading a line with
 * readline echoes it by default, so the terminal is put into raw mode for the
 * duration of the prompt: raw mode stops the tty driver from echoing what it
 * receives, which means this script has to handle the control characters the
 * driver would normally handle -- Enter to submit, Backspace to erase, Ctrl-C
 * to abort. That is what readSecret() below is doing, and it is the only
 * reason it is more than three lines long.
 *
 * WHY IT ASKS TWICE. There is no echo, so there is no way to see a typo, and
 * the failure mode of a typo here is severe and delayed: the update succeeds,
 * the script reports success, and you discover the problem the next time you
 * try to sign in -- with no way to recover except running this script again.
 * The confirmation prompt turns that into an immediate, obvious error.
 *
 * WHAT THIS DOES NOT DO. It does not touch `public.teachers`. The password
 * lives in `auth.users.encrypted_password` and nowhere else -- the `password`
 * column on `teachers` has been vestigial since the auth migration. Contrast
 * change-teacher-email.ts, which has to update both tables because the email
 * genuinely is stored twice.
 *
 * SIDE EFFECT: updating the password revokes every live session for that user
 * (GoTrue signs refresh tokens against the password hash). Whoever it belongs
 * to is signed out of every device and needs the new password to get back in.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase's project-wide minimum is 6 (the same setting that forces student
// PINs to be 6 digits rather than 4 -- see CLAUDE.md). That floor is fine for a
// PIN a teacher hands out on paper and resets on request; it is not fine for an
// account that can read every student in every class, so this script sets its
// own, higher floor rather than deferring to the project setting.
const MIN_LENGTH = 12;

// The keystrokes raw mode makes this script responsible for, named rather than
// written as escapes or as literal bytes. A raw control character in source is
// invisible in a diff and survives a copy-paste only by luck; a numeric escape
// is easy to typo into something that silently never matches.
// fromCharCode says exactly which byte is meant and cannot be mangled by an
// editor, a diff, or a shell.
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(8);
const LINE_FEED = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);
const DELETE = String.fromCharCode(127);

// The smallest printable character. Anything below it is a control code with no
// business in a password: an arrow key, for instance, arrives as a three-byte
// escape sequence and would otherwise become three invisible characters in the
// middle of the string.
const SPACE = String.fromCharCode(32);

/**
 * Print a message and stop, with a non-zero exit code.
 *
 * WHY THIS THROWS RATHER THAN CALLING process.exit().
 *
 * process.exit() tears the event loop down where it stands. The Supabase client
 * holds open handles (it is fetch underneath, with sockets and timers behind
 * it), and killing the loop mid-flight makes libuv abort on Windows:
 *
 *   Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c
 *
 * The message still prints, but the process then dies of the assertion instead
 * of the exit code -- so a caller checking $? sees 127 (or 134) and cannot tell
 * a bad email from a crash. Setting exitCode and throwing lets the loop drain
 * normally and exit with the code that was asked for.
 */
class Abort extends Error {}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exitCode = 1;
  throw new Abort(message);
}

/**
 * Prompt for a line on the tty without echoing it.
 *
 * Raw mode means every keystroke arrives here as a byte, including the ones the
 * terminal driver would normally act on itself, so each is handled explicitly:
 * Enter (either line ending) submits, Backspace and Delete erase, and both
 * Ctrl-C and Ctrl-D abort without changing anything.
 */
function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;

    if (!stdin.isTTY) {
      fail(
        "stdin is not a terminal, so the password cannot be read without echoing it.\n" +
          "  Run this script directly in your own terminal, not through a pipe or a wrapper.",
      );
    }

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";

    // Undo everything the prompt did to the terminal. Raw mode is a global
    // change to the tty, so leaving it on would hand a terminal that no longer
    // echoes back to the shell -- true on every exit path, including the
    // aborts.
    const restore = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === CARRIAGE_RETURN || char === LINE_FEED) {
          restore();
          stdout.write("\n");
          resolve(value);
          return;
        }

        // Rejecting rather than calling fail() directly: a throw inside an
        // EventEmitter listener does not propagate to the awaiting caller, it
        // becomes an uncaught exception. The rejection reaches main()'s catch
        // the same way every other failure does.
        if (char === CTRL_C || char === CTRL_D) {
          restore();
          stdout.write("\n");
          console.error("\n  Aborted. Nothing was changed.\n");
          process.exitCode = 1;
          reject(new Abort("aborted"));
          return;
        }

        if (char === DELETE || char === BACKSPACE) {
          value = value.slice(0, -1);
          continue;
        }

        if (char >= SPACE) value += char;
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const email = args.find((a) => !a.startsWith("--"));

  if (!email) {
    fail(
      "Usage: node --env-file=.env scripts/set-host-password.ts <email> [--dry-run]",
    );
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    fail(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
        "  Run with --env-file=.env, and check .env has the service-role key (not the publishable one).",
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the email to a user BEFORE prompting. Typing a password twice only
  // to be told the account does not exist is a poor trade, and listUsers is the
  // only lookup-by-email the admin API offers on the free plan.
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) fail(`Could not list users: ${listError.message}`);

  const target = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!target) fail(`No auth user with the email ${email}.`);

  // Confirm identity against public.teachers too, so a typo that happens to
  // match a *student's* synthetic address cannot silently rewrite their PIN.
  const { data: teacher } = await admin
    .from("teachers")
    .select("email, school_name, is_host")
    .eq("id", target.id)
    .maybeSingle();

  if (!teacher) {
    fail(
      `${email} exists in auth.users but is not a teacher.\n` +
        "  Student PINs are reset from the teacher dashboard, not with this script.",
    );
  }

  console.log(`\n  Account: ${teacher.email}`);
  console.log(`  School:  ${teacher.school_name}`);
  console.log(`  Role:    ${teacher.is_host ? "host" : "teacher"}`);
  console.log(`  User id: ${target.id}`);
  console.log(
    "\n  Nothing is echoed as you type. Updating the password signs this",
  );
  console.log("  account out of every device.\n");

  const first = await readSecret("  New password: ");
  if (first.length < MIN_LENGTH) {
    fail(
      `Password must be at least ${MIN_LENGTH} characters (got ${first.length}).`,
    );
  }

  const second = await readSecret("  Confirm:      ");
  if (first !== second) {
    fail("The two entries did not match. Nothing was changed.");
  }

  if (dryRun) {
    console.log(
      `\n  --dry-run: would set the password for ${teacher.email} (${first.length} characters).\n`,
    );
    return;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    target.id,
    { password: first },
  );
  if (updateError) fail(`Update failed: ${updateError.message}`);

  console.log(`\n  Password updated for ${teacher.email}.`);
  console.log("  Every existing session for this account has been revoked.");
  console.log(
    "\n  VERIFY IT BY SIGNING IN, not by trusting this message -- the same",
  );
  console.log(
    "  caution teacher_reset_pin() needs, and for the same reason: a write",
  );
  console.log("  that returns cleanly is not proof that login works.\n");
}

// An Abort has already printed its own message and set the exit code, so it
// just ends the process quietly. Anything else is an unexpected error and still
// needs reporting.
main().catch((err) => {
  if (err instanceof Abort) return;
  console.error(`\n  ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
