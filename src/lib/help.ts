import { supabase } from "./supabase";

/** Matches the column constraint and the check inside submit_help_message(). */
export const HELP_MESSAGE_MAX = 2000;

/**
 * Send a message from the Help page's contact box.
 *
 * One RPC, no table access: `help_messages` has no grants for any browser role,
 * so this function is the only door. student_id is filled in by the database
 * from auth.uid() -- it is deliberately not a parameter here, because anything
 * this file could pass, a hostile client could pass differently.
 *
 * Errors come back rather than throwing. The messages raised by the function
 * are already written to be read by a 13-year-old ("please keep it under 2000
 * characters"), so they are shown as-is; only the unrecognised case gets a
 * generic fallback.
 */
export async function submitHelpMessage(
  message: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Please write a message before sending." };
  }
  if (trimmed.length > HELP_MESSAGE_MAX) {
    return {
      ok: false,
      message: `That message is a bit too long — please keep it under ${HELP_MESSAGE_MAX} characters.`,
    };
  }

  const { error } = await supabase.rpc("submit_help_message", { p_message: trimmed });

  if (error) {
    // WHICH ERRORS ARE SAFE TO SHOW. The sentences submit_help_message() raises
    // are written for the person reading them ("please keep it under 2000
    // characters"), and they arrive with PostgreSQL's raise_exception code,
    // P0001. Everything else — a missing function, a permissions failure, a
    // dropped connection — is an internal detail whose real text helps nobody
    // and leaks how the back end is put together.
    //
    // This used to ask whether the message contained "fetch", on the theory
    // that network failures say "Failed to fetch" and everything else must
    // therefore be ours. That is not true of most of them: the same test in
    // contact.ts let a raw "Could not find the function public.<name>(<args>)
    // in the schema cache" onto the page in red. A student who cannot log in is
    // already having a bad time without being shown a schema-cache error.
    if (error.code === "P0001" && error.message) {
      return { ok: false, message: error.message };
    }
    // Swallowed for the reader, kept for whoever has to debug it — the same
    // move readableError() makes in teacherAuth.ts. Hiding an unexpected error
    // from the page should not mean losing it entirely.
    console.error("Unexpected error sending a help message", error);
    return {
      ok: false,
      message: "That didn't send. Please try again in a moment — or email hello@sprig.education.",
    };
  }

  return { ok: true };
}
