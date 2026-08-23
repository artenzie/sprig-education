import { supabase } from "./supabase";

/** Matches the column constraint and the check inside submit_contact_request(). */
export const CONTACT_MESSAGE_MAX = 400;

/**
 * Leave an email address from the Login page's contact strip.
 *
 * One RPC, no table access: `contact_requests` has no grants for any browser
 * role, so this function is the only door in. Same shape as submitHelpMessage()
 * next door, and for the same reasons -- see the long comment in
 * supabase/migrations/20260820000000_contact_requests.sql.
 *
 * Errors come back rather than throwing, and the sentences raised by the
 * function are shown as-is: they are already written for a person ("That does
 * not look like an email address"). Only the unrecognised case gets a fallback.
 *
 * NOTE ON THE VALIDATION BELOW. It is deliberately the same loose test the
 * database applies, not a stricter one. A client-side rule tighter than the
 * server's rejects addresses the server would happily have taken, and the
 * person on the other end has no way to tell which of the two turned them away.
 */
export async function submitContactRequest(
  email: string,
  message?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedMessage = (message ?? "").trim();

  if (trimmedEmail.length === 0) {
    return { ok: false, message: "Please enter an email address." };
  }
  if (trimmedEmail.indexOf("@") < 1 || trimmedEmail.length > 254) {
    return { ok: false, message: "That doesn't look like an email address." };
  }
  if (trimmedMessage.length > CONTACT_MESSAGE_MAX) {
    return {
      ok: false,
      message: `That note is a bit long — please keep it under ${CONTACT_MESSAGE_MAX} characters.`,
    };
  }

  const { error } = await supabase.rpc("submit_contact_request", {
    p_email: trimmedEmail,
    // EXPLICIT null, not undefined. supabase-js drops undefined keys from the
    // JSON body entirely, and PostgREST resolves an RPC by the exact set of
    // argument NAMES it was given — so omitting this sends it hunting for a
    // one-argument `submit_contact_request(p_email)` rather than calling the
    // two-argument one with its default. Sending null names both parameters
    // and always resolves. The function turns '' and null into the same thing
    // anyway (`nullif(btrim(coalesce(...)), '')`), so the column still ends up
    // genuinely empty rather than holding a blank string.
    p_message: trimmedMessage.length > 0 ? trimmedMessage : null,
  });

  if (error) {
    // WHICH ERRORS ARE SAFE TO SHOW. The messages this schema raises with
    // `raise exception` are written as sentences for the person reading them
    // ("That does not look like an email address"), and those arrive with
    // PostgreSQL's raise_exception code, P0001. Everything else — a missing
    // function, a permissions failure, a dropped connection — is an internal
    // detail whose real text helps nobody and leaks how the back end is put
    // together. The first version of this keyed off whether the text contained
    // "fetch", which let a raw
    // "Could not find the function public.submit_contact_request(p_email) in
    // the schema cache" straight onto the page.
    if (error.code === "P0001" && error.message) {
      return { ok: false, message: error.message };
    }
    // Swallowed for the reader, kept for whoever has to debug it — the same
    // move readableError() makes in teacherAuth.ts. Hiding an unexpected error
    // from the page should not mean losing it entirely.
    console.error("Unexpected error leaving a contact request", error);
    return {
      ok: false,
      message: "That didn't send. Please try again in a moment — or email hello@sprig.study.",
    };
  }

  return { ok: true };
}
