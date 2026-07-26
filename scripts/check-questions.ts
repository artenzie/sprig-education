/**
 * Check that every question in the bank can stand on its own.
 *
 *   node --env-file=.env scripts/check-questions.ts
 *   node --env-file=.env scripts/check-questions.ts --strict
 *   node --env-file=.env scripts/check-questions.ts --list-ok
 *
 * WHY THIS EXISTS
 *
 * Every question in Sprig was written for the Lesson flow, where order is fixed
 * and the slides sit directly above. That makes "using the example above" a
 * perfectly correct thing to write — the referent really is there.
 *
 * The baseline and Growth Check flows broke that assumption. selectTestQuestions()
 * shuffles within a topic and deals round-robin across topics, so a question
 * arrives with no guarantee that anything preceding it is on screen, or in the
 * paper at all. The same row is now consumed under two different contracts, and
 * nothing in the schema records which one it was written under.
 *
 * That mismatch fails silently and in the worst possible way: the question
 * renders perfectly and is simply unanswerable. Question 61e19c00 reached a real
 * baseline on 26 July 2026 as a numeric input with no numbers in it (see
 * supabase/migrations/20260726000000_decontextualise_goal_checkpoint_question.sql).
 *
 * WHY A SCRIPT RATHER THAN A CONSTRAINT
 *
 * Content is seeded by pasting SQL into the Supabase SQL Editor, so there is no
 * seed step to hook into. A CHECK constraint could express the digits rule but
 * not the judgement half, and a constraint that rejects a paste mid-migration is
 * a much worse experience than a report you run afterwards. So: run this after
 * seeding new content.
 *
 * WHAT IT CANNOT DO
 *
 * It checks *lexical* self-containment only. A question that silently assumes a
 * definition taught two slides earlier reads as perfectly self-contained and
 * passes every rule here. That is partly by design — a baseline deliberately
 * includes untaught material — but it means a clean run means "no question
 * points at something that isn't there", not "every question is fair".
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Phrases that point at something outside the question.
 *
 * Bare "above" and "below" are in here deliberately. They are what caught the
 * real bug ("Using the example above"), and the cost of including them is the
 * occasional false positive on a phrase like "can't go below zero" — which is
 * reviewed once and allowlisted below, permanently. The reverse trade would
 * have missed the only bug this check has ever had to find.
 *
 * These are warnings, not errors, because only a human can tell "Same scenario
 * (£25 for the month; A transport £12, ...)" — which restates its figures and
 * is fine — from "Same scenario. What is the total?", which is not.
 */
const BACK_REFERENCES: { pattern: RegExp; label: string }[] = [
  { pattern: /\bthe example above\b/i, label: "the example above" },
  { pattern: /\babove\b/i, label: "above" },
  { pattern: /\bbelow\b/i, label: "below" },
  { pattern: /\bprevious (question|slide|example|page)\b/i, label: "previous ..." },
  { pattern: /\bearlier\b/i, label: "earlier" },
  { pattern: /\bsame (scenario|example|figures|numbers)\b/i, label: "same ..." },
  { pattern: /\bthat example\b/i, label: "that example" },
  { pattern: /\bas before\b/i, label: "as before" },
  { pattern: /\bjust seen\b/i, label: "just seen" },
];

/** Opens with a reference that has no antecedent inside the question. */
const BARE_OPENING = /^(This|That|These|Those|It|They|He|She|Their|Its|His|Her)\b/;

/**
 * Questions reviewed by a human and confirmed fine, keyed by id.
 *
 * An entry here is a decision, not a mute button — hence the reason field. If a
 * question's text is later edited, re-read the reason before trusting it: the
 * id survives the edit, so a stale entry would suppress a genuine new problem.
 */
const REVIEWED: Record<string, string> = {
  "676f3abf-1609-4106-a770-c9f5763ec2ab":
    'Says "Same scenario" but restates every figure it needs (£25, A £12, D £18), so it stands alone.',
  "e7ce01d5-e9ca-471b-8abc-4957428f73dd":
    'Matches on "below" only via the phrase "go below zero" — not a back-reference at all.',
};

type Severity = "error" | "warn";

type Question = {
  id: string;
  question_text: string;
  question_type: string;
  order: number;
  subtopics: { title: string; topics: { title: string } | null } | null;
};

type Finding = { severity: Severity; rule: string; detail: string; question: Question };

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const listOk = args.includes("--list-ok");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    fail(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add both to .env (see .env.example) and run with --env-file=.env.",
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The service-role key is used because `questions` is readable anonymously
  // only through the public-content grant, and this script should report on the
  // bank as it actually is rather than as a student happens to see it.
  const { data, error } = await admin
    .from("questions")
    .select("id, question_text, question_type, order, subtopics(title, topics(title))")
    .order("subtopic_id")
    .order("order");

  if (error) fail(`Could not read questions: ${error.message}`);

  const questions = (data ?? []) as unknown as Question[];
  if (questions.length === 0) fail("No questions found — is this pointing at the right project?");

  const findings: Finding[] = [];

  for (const question of questions) {
    const text = question.question_text;

    // RULE 1 (error) — a numeric question that contains no numbers.
    //
    // Strong, but a heuristic rather than a true invariant: "How many days are
    // in a week?" is a legitimate digit-free `num` question. It is an error
    // anyway because on the current bank it has zero false positives and it is
    // the rule that would have caught 61e19c00 before a student saw it. A real
    // exception is one REVIEWED entry away.
    if (question.question_type === "num" && !/\d/.test(text)) {
      findings.push({
        severity: "error",
        rule: "num-without-digits",
        detail: "Numeric answer expected, but the question supplies no numbers.",
        question,
      });
    }

    // RULE 2 (warn) — points at something outside itself.
    for (const { pattern, label } of BACK_REFERENCES) {
      if (pattern.test(text)) {
        findings.push({
          severity: "warn",
          rule: "back-reference",
          detail: `Contains "${label}" — check the referent is inside the question.`,
          question,
        });
        break; // One finding per question; the first match is enough to prompt a read.
      }
    }

    // RULE 3 (warn) — opens with a pronoun that has nothing to refer to.
    if (BARE_OPENING.test(text)) {
      findings.push({
        severity: "warn",
        rule: "bare-opening",
        detail: "Opens with a pronoun or demonstrative that has no antecedent.",
        question,
      });
    }
  }

  const suppressed = findings.filter((f) => REVIEWED[f.question.id]);
  const active = findings.filter((f) => !REVIEWED[f.question.id]);
  const errors = active.filter((f) => f.severity === "error");
  const warnings = active.filter((f) => f.severity === "warn");

  console.log(`\nChecked ${questions.length} questions.\n`);

  report("ERROR", errors);
  report("WARNING", warnings);

  if (listOk && suppressed.length > 0) {
    console.log(`Suppressed by review (${suppressed.length}):\n`);
    for (const finding of suppressed) {
      console.log(`  ${finding.question.id}  [${finding.rule}]`);
      console.log(`    ${REVIEWED[finding.question.id]}\n`);
    }
  }

  const summary =
    `${errors.length} error${plural(errors.length)}, ` +
    `${warnings.length} warning${plural(warnings.length)}` +
    (suppressed.length > 0 ? `, ${suppressed.length} suppressed by review` : "");

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`No problems found — ${summary}.`);
    console.log("Note: this checks wording only. It cannot tell whether a question is fair.\n");
    return;
  }

  console.log(summary + ".\n");

  if (errors.length > 0 || (strict && warnings.length > 0)) {
    process.exitCode = 1;
  }
}

function report(heading: string, findings: Finding[]) {
  if (findings.length === 0) return;

  console.log(`${heading}${plural(findings.length)} (${findings.length}):\n`);
  for (const { rule, detail, question } of findings) {
    const topic = question.subtopics?.topics?.title ?? "?";
    const subtopic = question.subtopics?.title ?? "?";
    console.log(`  ${question.id}  [${rule}]`);
    console.log(`    ${topic} → ${subtopic} (question ${question.order})`);
    console.log(`    ${truncate(question.question_text, 100)}`);
    console.log(`    ${detail}\n`);
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

/** An error we produced deliberately, as opposed to one that surprised us. */
class ScriptError extends Error {}

/**
 * Bail out with a message.
 *
 * Throws rather than calling process.exit(), for the same reason
 * create-students.ts does: on Windows, exiting while supabase-js still has open
 * sockets crashes libuv with "Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING)" and buries the real error under a native stack trace.
 */
function fail(message: string): never {
  throw new ScriptError(message);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof ScriptError ? error.message : error);
  process.exitCode = 1;
}
