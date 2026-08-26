import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { useAuth } from "@/context/auth";
import type { Role, Teacher } from "@/context/auth";
import { PIN_LENGTH, keepDigits } from "@/lib/studentAuth";
import { submitContactRequest, CONTACT_MESSAGE_MAX } from "@/lib/contact";

/**
 * Where a signed-in account belongs.
 *
 * PURELY A DESTINATION, not a permission. Nothing here grants anything: a host
 * lands on /host because that is the page they want, and a non-host is sent to
 * /teacher because /host would be an empty page for them — the six RLS policies
 * behind it evaluate `public.is_host()` in the database and return nothing to
 * anybody else. Editing this function changes which page loads first and has no
 * effect whatsoever on what any of them can read. RequireHost and RequireTeacher
 * are untouched by it.
 *
 * `is_host` is read off the teachers row, which arrives from a policy-filtered
 * select of the user's OWN row — so a browser that forced it to true would send
 * itself to a dashboard with every section empty.
 */
function landingFor(role: Role, teacher: Teacher | null): string {
  if (role !== "teacher") return "/dashboard";
  return teacher?.is_host ? "/host" : "/teacher";
}

function Login() {
  const { status, role, teacher } = useAuth();

  // Already signed in — no reason to show them a login form. Which half of the
  // app they belong to is decided by which table has a row for them, so this
  // has to ask. Sending a teacher to /dashboard would bounce them straight to
  // /teacher; sending a student to /teacher would bounce them back. Both work,
  // and both would flash a screen nobody meant to show. If a student still
  // owes us a PIN change, RequireAuth on /dashboard picks that up.
  //
  // This is now the ONLY place that decides where a signed-in adult lands —
  // see the note in AdultBox's submit handler for why it stopped navigating
  // for itself.
  if (status === "authed") {
    return <Navigate to={landingFor(role, teacher)} replace />;
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <TopNav />

      <section className="mx-auto max-w-[1180px] px-10 pb-24 pt-16">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Enter the field guide</span>
          <span className="h-px w-8 bg-border" />
          <span>Anonymous by design</span>
        </div>

        <div className="mt-10 grid grid-cols-12 gap-x-0 gap-y-10 lg:gap-16">
          <div className="col-span-12 lg:col-span-7">
            <h1 className="font-display text-[54px] font-normal leading-[1.02] tracking-[-0.035em]">
              A quiet <em className="font-normal italic text-forest">door</em>{" "}
              in.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-muted-foreground">
              Sprig is fully anonymous for students — we never ask for real
              names, emails, or anything identifying. Each student is given a
              randomly assigned nickname and a PIN by their teacher. That
              pairing is the whole account.
            </p>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-12 gap-x-0 gap-y-8 lg:gap-10">
          <StudentBox />
          <AdultBox />
        </div>

        <ContactStrip />
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1180px] items-center justify-center px-10 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Sprig · A field guide to money</span>
        </div>
      </footer>
    </div>
  );
}

function StudentBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithNickname } = useAuth();

  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);
    try {
      const result = await signInWithNickname(nickname, pin);
      if (!result.ok) {
        setError(result.message);
        // Clear the PIN but keep the nickname: the nickname is almost never
        // the part they got wrong, and retyping it is a chore.
        setPin("");
        return;
      }

      // If they were bounced here from somewhere specific, send them back.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? "/dashboard", { replace: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="col-span-12 lg:col-span-6">
      <div className="flex h-full flex-col border border-border/70 bg-background/40 p-10">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>I</span>
          <span className="h-px w-6 bg-border" />
          <span>Student</span>
        </div>

        <h2 className="mt-6 font-display text-[34px] font-normal leading-[1.05] tracking-[-0.03em]">
          Your <em className="font-normal italic text-forest">sprig</em>{" "}
          is waiting.
        </h2>

        <p className="mt-4 text-[14px] leading-[1.7] text-muted-foreground">
          Use the nickname and PIN your teacher gave you. No email, no last
          name, no photo — ever.
        </p>

        <form className="mt-9 space-y-6" onSubmit={handleSubmit}>
          <FieldLine
            label="Nickname"
            placeholder="e.g. Curious Squirrel"
            value={nickname}
            onChange={setNickname}
            autoComplete="username"
            disabled={pending}
          />
          <FieldLine
            label="PIN"
            placeholder={`${PIN_LENGTH}-digit code`}
            type="password"
            value={pin}
            onChange={(value) => setPin(keepDigits(value))}
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            autoComplete="current-password"
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
                {pending ? "Checking" : "Continue"}
              </span>
              <span className="block text-[15px] font-medium text-foreground">
                {pending ? "One moment…" : "Log in to your journey"}
              </span>
            </span>
          </button>
        </form>

        {/* The "Sign Up" half of the nav's Login / Sign Up lands here. There is
            no student signup form and there is not meant to be one: an account
            is a nickname and PIN handed out by a teacher, which is also what
            keeps students anonymous. So this says where accounts actually come
            from rather than offering a form that could not work. */}
        <div className="mt-auto pt-10">
          <div className="h-px w-full bg-border/70" />
          <p className="mt-5 text-[13px] leading-[1.7] text-muted-foreground">
            Don't have an account?{" "}
            <span className="text-foreground">
              Ask your teacher or parent.
            </span>{" "}
            There's no sign-up form — accounts are handed out in class, so
            nobody has to give us a name or an email.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The teacher's way in.
 *
 * This used to be a mock with a Log in / Sign up toggle. The toggle is gone,
 * and not just because the signup half was never wired: there is no signup at
 * all. New-user signups are off project-wide in the Supabase dashboard, and
 * turning them on so teachers could register themselves would also re-open
 * self-registration to anyone who found the endpoint — with nothing to tell a
 * real teacher from a stranger curious about a class. During the pilot,
 * accounts are made with scripts/create-teacher.ts by someone holding the
 * service-role key. A form that cannot work is worse than no form.
 *
 * The "Parent" in the heading is aspirational and stays for now; parents have
 * no account type yet.
 */
function AdultBox() {
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);

    const result = await signInWithEmail(email, password);
    if (!result.ok) {
      setError(result.message);
      // Clear the password but keep the email, for the same reason the
      // student form keeps the nickname: it's almost never the wrong half.
      setPassword("");
      setPending(false);
      return;
    }

    // Deliberately no navigate() here, and deliberately no setPending(false).
    //
    // This used to be `navigate("/teacher")`, which cannot work now that where
    // an adult lands depends on `is_host`: at the moment sign-in resolves, the
    // teachers row has not been read yet, so `teacher` is still null and this
    // handler has no way to tell a host from anybody else. Anything it decided
    // here would be a guess, and the guess would be wrong for exactly the
    // account the feature is for.
    //
    // So the redirect is left to the `status === "authed"` guard at the top of
    // Login(), which by definition only runs once the profile for THIS user
    // has loaded (see profilesUserId in AuthProvider). Leaving `pending` true
    // holds the form in its "One moment…" state across that gap rather than
    // flashing an enabled form nobody is meant to use again.
  }

  return (
    <div className="col-span-12 lg:col-span-6">
      <div className="flex h-full flex-col border border-border/70 bg-background/40 p-10">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>II</span>
          <span className="h-px w-6 bg-border" />
          <span>Teacher &nbsp;·&nbsp; Host &nbsp;·&nbsp; Parent</span>
        </div>

        <h2 className="mt-6 font-display text-[34px] font-normal leading-[1.05] tracking-[-0.03em]">
          Welcome <em className="font-normal italic text-forest">back</em>.
        </h2>

        <p className="mt-4 text-[14px] leading-[1.7] text-muted-foreground">
          Sign in to unlock a locked-out student or reset a forgotten PIN.
        </p>

        <form className="mt-9 space-y-6" onSubmit={handleSubmit}>
          <FieldLine
            label="Email"
            placeholder="you@school.uk"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
            disabled={pending}
          />
          <FieldLine
            label="Password"
            placeholder="Your password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
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
                {pending ? "Checking" : "Continue"}
              </span>
              <span className="block text-[15px] font-medium text-foreground">
                {pending ? "One moment…" : "Log in"}
              </span>
            </span>
          </button>
        </form>

        {/* "Get in touch" was a plain <span> for as long as this box has
            existed — styled like a link, doing nothing. It now moves focus to
            the email field in ContactStrip below, which is the other end of
            the sentence it was always promising. */}
        <div className="mt-auto pt-10">
          <div className="h-px w-full bg-border/70" />
          <p className="mt-5 text-[13px] leading-[1.7] text-muted-foreground">
            Teacher accounts are set up for you during the pilot.{" "}
            <a
              href={`#${CONTACT_FIELD_ID}`}
              onClick={(event) => {
                // Let the hash navigation do the scrolling, then put the caret
                // where they plainly meant to go. Without this the page jumps
                // to the box and leaves them to click again.
                event.preventDefault();
                const field = document.getElementById(CONTACT_FIELD_ID);
                field?.scrollIntoView({ behavior: "smooth", block: "center" });
                field?.focus({ preventScroll: true });
              }}
              className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-forest hover:decoration-forest"
            >
              Get in touch
            </a>{" "}
            and we'll make you one.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Leave-your-email, for an adult who does not have an account and cannot get
 * one by filling in a form.
 *
 * WHY IT IS NOT A THIRD BORDERED CARD. StudentBox and AdultBox are two ways
 * IN, drawn as two matching bordered panels side by side. This is not a third
 * one — nothing here signs anybody in, and a matching card would say it did.
 * So it sits below both, full width, on a hairline rather than a border, with
 * the fields on one row. The visual weight is the message: this is an aside,
 * and the two boxes above are still the point of the page.
 *
 * The note field is optional and short by design. An email on its own means
 * every reply has to open by asking what the person wanted; 400 characters is
 * room for "Head of Maths at X, asking about September" and deliberately not
 * room for a support request, which is what /help is for.
 */
const CONTACT_FIELD_ID = "sprig-contact-email";

function ContactStrip() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);
    const result = await submitContactRequest(email, note);
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    // Cleared only once the row has actually landed, matching the Help box:
    // clearing optimistically throws away what they typed if the write failed.
    setEmail("");
    setNote("");
    setSent(true);
  }

  return (
    <div className="mt-20">
      <div className="h-px w-full bg-border/70" />

      <div className="mt-8 grid grid-cols-12 gap-x-0 gap-y-6 lg:gap-x-10">
        <div className="col-span-12 lg:col-span-4">
          <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
            <span>III</span>
            <span className="h-px w-6 bg-border" />
            <span>Not a login</span>
          </div>
          <p className="mt-4 max-w-sm text-[13.5px] leading-[1.7] text-muted-foreground">
            A teacher, parent or school wanting to bring Sprig to students —
            leave an address and Artem will get in touch. This doesn't create
            an account or sign you in.
          </p>
        </div>

        <div className="col-span-12 lg:col-span-8">
          {sent ? (
            /* Careful about what this claims. It says the address is written
               down, which is true and checkable, and that a reply comes by
               email, which is the only channel that exists. It deliberately
               does not promise a timeframe — the Help box's first version
               promised two days with nothing behind it, and that is recorded
               in 20260817000000 as the mistake not to repeat. */
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="text-[15px] leading-[1.7] text-foreground">
                Thank you — that's saved.
              </p>
              <p className="text-[13.5px] leading-[1.7] text-muted-foreground">
                Artem reads these and will reply by email.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-4 transition-colors hover:text-forest hover:underline"
              >
                Add another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-12 gap-x-0 gap-y-6 sm:gap-x-8">
                <div className="col-span-12 sm:col-span-5">
                  <FieldLine
                    id={CONTACT_FIELD_ID}
                    label="Your email"
                    placeholder="you@school.uk"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="email"
                    disabled={pending}
                  />
                </div>
                <div className="col-span-12 sm:col-span-7">
                  <FieldLine
                    label="Anything to add (optional)"
                    placeholder="e.g. Head of Maths, asking about September"
                    value={note}
                    onChange={setNote}
                    maxLength={CONTACT_MESSAGE_MAX}
                    disabled={pending}
                  />
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-5 text-[13px] leading-[1.6] text-[color:var(--destructive)]"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="group mt-7 inline-flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                {/* Smaller than the two sign-in buttons above (h-9 against
                    h-11) and outlined rather than filled — the same control,
                    quieter, so it does not read as a third way in. */}
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/80 text-foreground transition-colors group-hover:border-forest group-hover:text-forest">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
                <span className="text-[14px] font-medium text-foreground">
                  {pending ? "Sending…" : "Leave my email"}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The underline-style input used by both boxes.
 *
 * `value`/`onChange` are still optional, though both boxes now pass them —
 * they were optional so the teacher form could sit here as an uncontrolled
 * mock, and that is over. Pass both or neither: passing only `value` makes
 * React complain about a controlled input with no change handler.
 */
function FieldLine({
  id,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  inputMode,
  maxLength,
  autoComplete,
  disabled,
}: {
  /** Only set where something needs to link to the field — see CONTACT_FIELD_ID. */
  id?: string;
  label: string;
  placeholder?: string;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  inputMode?: "text" | "numeric";
  maxLength?: number;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </span>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        disabled={disabled}
        // Two mobile constraints, both absolute rather than aesthetic:
        //
        // min-h-11 is 44px, the tap-target floor. Underlined inputs are ~31px
        // tall from their text plus pb-2, which is comfortable with a mouse and
        // too small for a thumb -- and these two fields are the whole of a
        // student's first interaction with Sprig on a phone. Dropped back to
        // auto at lg so the desktop layout is unchanged.
        //
        // text-[16px] is the iOS zoom floor, and it is NOT dropped back at lg,
        // because a 1px difference is invisible and a breakpoint here would be
        // one more place for the floor to be lost. See QuestionCard.tsx for the
        // full note on why 16px specifically.
        className="mt-2 min-h-11 w-full border-0 border-b border-border/80 bg-transparent pb-2 font-sans text-[16px] text-foreground placeholder:text-muted-foreground/60 focus:border-forest focus:outline-none disabled:opacity-60 lg:min-h-0"
      />
    </label>
  );
}

export default Login;
