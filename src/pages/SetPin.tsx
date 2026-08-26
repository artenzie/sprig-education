import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import {
  PIN_LENGTH,
  describeWeakPin,
  isValidPin,
  keepDigits,
  nicknameToEmail,
} from "@/lib/studentAuth";

/**
 * Choosing a PIN — the forced first-time change, and voluntary changes later.
 *
 * Every student is created on the shared starter PIN (000000), which means
 * that until they change it, anyone who knows the convention can sign in as
 * them. So RequireAuth funnels them here and won't let them past until it's
 * done; see src/routes/RequireAuth.tsx.
 *
 * The two modes differ in one meaningful way: the forced version doesn't ask
 * for the current PIN, because they typed it seconds ago to get here. The
 * voluntary version does, and re-verifies it — see the comment on
 * verifyCurrentPin below for why that isn't optional.
 */
function SetPin() {
  const navigate = useNavigate();
  const { student, refreshStudent, signOut } = useAuth();

  const forced = student?.must_change_pin ?? false;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !student) return;

    // Validate before touching the network, so a mistyped confirmation
    // doesn't cost a round trip.
    if (!isValidPin(next)) {
      setError(`Your new PIN needs to be exactly ${PIN_LENGTH} digits.`);
      return;
    }
    const weak = describeWeakPin(next);
    if (weak) {
      setError(weak);
      return;
    }
    if (next !== confirm) {
      setError("Those two PINs don't match.");
      return;
    }
    if (!forced && !isValidPin(current)) {
      setError("Enter your current PIN.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      // Supabase's updateUser() changes the password without checking the old
      // one. For the forced flow that's fine — they just authenticated. For a
      // voluntary change it is not: an unattended logged-in laptop would
      // otherwise be enough to lock a classmate out of their own account. So
      // we prove they know the current PIN by signing in with it.
      if (!forced) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: nicknameToEmail(student.nickname),
          password: current,
        });
        if (verifyError) {
          setError("That isn't your current PIN.");
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Only now clear the flag. If this call fails the student keeps their
      // new PIN and simply gets asked again next time — the safe way round.
      const { error: flagError } = await supabase.rpc("complete_pin_change");
      if (flagError) {
        console.error("PIN changed, but the flag didn't clear", flagError);
      }

      await refreshStudent();
      navigate("/dashboard", { replace: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-[1180px] px-10 pb-24 pt-20">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>{forced ? "One step first" : "Your account"}</span>
          <span className="h-px w-8 bg-border" />
          <span>{student?.nickname ?? "Student"}</span>
        </div>

        <div className="mt-10 grid grid-cols-12 gap-x-0 gap-y-10 lg:gap-16">
          <div className="col-span-12 lg:col-span-7">
            <h1 className="font-display text-[54px] font-normal leading-[1.02] tracking-[-0.035em]">
              {forced ? (
                <>
                  Choose a PIN only{" "}
                  <em className="font-normal italic text-forest">you</em> know.
                </>
              ) : (
                <>
                  Change your{" "}
                  <em className="font-normal italic text-forest">PIN</em>.
                </>
              )}
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-muted-foreground">
              {forced
                ? `Everyone starts on the same PIN, so it isn't really yours yet. Pick ${PIN_LENGTH} digits you'll remember — nobody can look it up for you afterwards, so if you forget it your teacher will reset it.`
                : `Pick ${PIN_LENGTH} new digits. You'll need your current PIN to confirm it's you.`}
            </p>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-12 gap-x-0 gap-y-8 lg:gap-10">
          <div className="col-span-12 lg:col-span-6">
            <div className="border border-border/70 bg-background/40 p-10">
              <form className="space-y-6" onSubmit={handleSubmit}>
                {!forced && (
                  <PinField
                    label="Current PIN"
                    value={current}
                    onChange={setCurrent}
                    autoComplete="current-password"
                    disabled={pending}
                  />
                )}
                <PinField
                  label="New PIN"
                  value={next}
                  onChange={setNext}
                  autoComplete="new-password"
                  disabled={pending}
                />
                <PinField
                  label="Confirm new PIN"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  disabled={pending}
                />

                {error && (
                  <p
                    role="alert"
                    className="text-[13px] leading-[1.6] text-[color:var(--destructive)]"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="group mt-2 inline-flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-primary-foreground transition-transform group-hover:-translate-y-0.5 group-disabled:translate-y-0">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {pending ? "Saving" : "Confirm"}
                    </span>
                    <span className="block text-[15px] font-medium text-foreground">
                      {pending ? "One moment…" : "Save my PIN"}
                    </span>
                  </span>
                </button>
              </form>

              {forced && (
                <div className="mt-10">
                  <div className="h-px w-full bg-border/70" />
                  <p className="mt-5 text-[13px] leading-[1.7] text-muted-foreground">
                    Not your account?{" "}
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-forest"
                    >
                      Sign out
                    </button>
                    .
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </span>
      <input
        type="password"
        // inputMode="numeric" brings up the number pad on a tablet rather than
        // the full keyboard — most of the pilot schools are iPad-first.
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder={`${PIN_LENGTH}-digit code`}
        maxLength={PIN_LENGTH}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(keepDigits(e.target.value))}
        // min-h-11 (44px) for the same reason as the matching input in
        // Login.tsx -- see the note there. This one matters slightly more: it is
        // on the forced first-login screen, so every student hits it before
        // they can reach anything else.
        className="mt-2 min-h-11 w-full border-0 border-b border-border/80 bg-transparent pb-2 font-mono text-[16px] tracking-[0.3em] text-foreground placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60 focus:border-forest focus:outline-none disabled:opacity-60 lg:min-h-0"
      />
    </label>
  );
}

export default SetPin;
