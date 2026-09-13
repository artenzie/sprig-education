/**
 * The hand-off behind the host dashboard's "View as student" shortcut.
 *
 * WHY NOT ROUTER STATE. The first version signed out and then called
 * navigate("/login", { state: { nickname } }). It never worked: BrowserRouter
 * applies location changes inside startTransition (low priority), while the
 * auth change from signOut() is urgent. So React rendered "signed out, still
 * on /host" first, RequireHost answered with its own <Navigate to="/login">,
 * and that redirect replaced the history entry carrying the nickname. Which
 * navigation wins is React's scheduling, not ours.
 *
 * sessionStorage takes the router out of it: the nickname is written BEFORE
 * signing out, RequireHost's ordinary redirect delivers the host to /login, and
 * the form reads it there. It is scoped to the tab and removed as soon as the
 * login page has read it, so it prefills once.
 *
 * Only a nickname is ever stored — never a PIN. Storage can be unavailable
 * (private mode, blocked site data), so every access is guarded; the worst case
 * is an empty field, which is where we were before the shortcut existed.
 */

const KEY = "sprig:preview-nickname";

export function setPreviewNickname(nickname: string): void {
  try {
    sessionStorage.setItem(KEY, nickname);
  } catch {
    // Storage unavailable — the shortcut still signs out, just without a prefill.
  }
}

/** Read without removing, so it is safe inside a useState initializer (StrictMode runs those twice). */
export function peekPreviewNickname(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPreviewNickname(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
