/**
 * Sprig student identity — how a nickname and a PIN become a Supabase account.
 *
 * Supabase Auth is built around email + password. Sprig students have neither:
 * they have a nickname their teacher handed them and a 6-digit PIN, and we
 * deliberately never collect an email address, a surname or anything else
 * identifying (students are anonymous by design — see CLAUDE.md).
 *
 * So we bridge the two rather than replace either. The nickname is turned into
 * a synthetic email address the student never sees or types, and the PIN is
 * used verbatim as the Supabase password. Everything downstream is then plain,
 * unmodified Supabase: it hashes the PIN with bcrypt, issues and refreshes the
 * session, and exposes the student's id to our RLS policies as auth.uid().
 * Nothing about credential handling is hand-rolled.
 *
 * This file is imported by BOTH the login form and scripts/create-students.ts,
 * and that is the whole point. If those two ever computed the address
 * differently, accounts would be created under one address and logged into
 * under another — and the symptom would be "my PIN doesn't work", which tells
 * you nothing about the real cause.
 */

/**
 * Where synthetic student addresses live.
 *
 * A real domain, not a reserved one like `.invalid` or `.local`. Undeliverable
 * TLDs would be tidier in principle, but Supabase can apply extended email
 * validation that rejects domains with no MX record, and being rejected at
 * account-creation time is a much worse failure than a theoretical address.
 * No mail is ever sent here regardless: email confirmations are off and
 * accounts are created already confirmed.
 */
const STUDENT_EMAIL_DOMAIN = "students.sprig.study";

/**
 * Six digits, not four.
 *
 * Supabase's minimum password length is 6 and it is a single project-wide
 * setting, so a 4-digit PIN would have meant either lowering that floor for
 * teacher passwords too, or padding the PIN with a magic constant that every
 * admin script would have to remember. Six digits sidesteps both, and is 100x
 * harder to guess (a million combinations rather than ten thousand) — which
 * matters more than usual here, because the lockout in
 * supabase/migrations/20260725020000_login_lockout.sql only covers attempts
 * made through this app.
 */
export const PIN_LENGTH = 6;

/** Every student is created with this and forced to change it on first login. */
export const DEFAULT_PIN = "000000";

/**
 * Failures allowed before a nickname locks.
 *
 * Used only to word the error message. The real rule is
 * public.login_max_attempts() in the lockout migration — this constant is a
 * copy of it, so keep the two in step.
 */
export const MAX_LOGIN_ATTEMPTS = 5;

/**
 * "  Curious   Squirrel " -> "curious-squirrel"
 *
 * Mirrors public.nickname_slug() in the lockout migration; the two must agree.
 *
 * Lowercasing and collapsing punctuation is what makes login forgiving, which
 * matters when the person typing is 13 and the nickname is two words they were
 * handed on a slip of paper: "curious squirrel", "Curious-Squirrel" and
 * "CURIOUS  SQUIRREL" all resolve to the same account.
 */
export function nicknameToSlug(nickname: string): string {
  return nickname
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Curious Squirrel" -> "curious-squirrel@students.sprig.study" */
export function nicknameToEmail(nickname: string): string {
  const slug = nicknameToSlug(nickname);
  if (!slug) {
    throw new Error("A nickname needs at least one letter or number.");
  }
  return `${slug}@${STUDENT_EMAIL_DOMAIN}`;
}

/** Initials for the avatar: "Curious Squirrel" -> "CS". */
export function nicknameInitials(nickname: string): string {
  const initials = nickname
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "");
  return initials.join("") || "?";
}

/** Strips anything that isn't a digit, and caps the length. For PIN inputs. */
export function keepDigits(value: string, max: number = PIN_LENGTH): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Exactly six digits, nothing else. */
export function isValidPin(pin: string): boolean {
  return pin.length === PIN_LENGTH && /^\d+$/.test(pin);
}

/**
 * Explains why a PIN is too guessable, or returns null if it's fine.
 *
 * Returning the reason rather than a bare boolean is deliberate: "that's too
 * easy to guess" leaves a student poking at the form, while naming the actual
 * problem lets them fix it on the next try.
 *
 * This is a client-side nudge, not a security boundary — someone determined to
 * use a weak PIN can. It exists because the alternative to nudging is a class
 * where a third of the PINs are 123456.
 */
export function describeWeakPin(pin: string): string | null {
  if (pin === DEFAULT_PIN) {
    return "That's the starter PIN everyone is given. Choose your own.";
  }
  if (/^(\d)\1*$/.test(pin)) {
    return "A PIN of one repeated digit is too easy to guess.";
  }
  if (isRun(pin)) {
    return "Digits in a straight run are too easy to guess.";
  }
  return null;
}

/** True for runs like 123456 and 654321. */
function isRun(pin: string): boolean {
  const digits = [...pin].map(Number);
  const step = digits[1] - digits[0];
  if (step !== 1 && step !== -1) return false;
  return digits.every((digit, i) => i === 0 || digit - digits[i - 1] === step);
}
