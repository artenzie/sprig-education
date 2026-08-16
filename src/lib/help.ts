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
    // A raised exception arrives with the sentence we wrote; anything else is a
    // network or permissions failure whose real text would not help anybody.
    return {
      ok: false,
      message:
        error.message && !error.message.toLowerCase().includes("fetch")
          ? error.message
          : "That didn't send. Check your connection and try again — or email hello@sprig.study.",
    };
  }

  return { ok: true };
}
