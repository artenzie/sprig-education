import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";
import { useAuth } from "@/context/auth";
import { PIN_LENGTH, keepDigits } from "@/lib/studentAuth";

function Login() {
  const { status, role } = useAuth();

  // Already signed in — no reason to show them a login form. Which half of the
  // app they belong to is decided by which table has a row for them, so this
  // has to ask. Sending a teacher to /dashboard would bounce them straight to
  // /teacher; sending a student to /teacher would bounce them back. Both work,
  // and both would flash a screen nobody meant to show. If a student still
  // owes us a PIN change, RequireAuth on /dashboard picks that up.
  if (status === "authed") {
    return <Navigate to={role === "teacher" ? "/teacher" : "/dashboard"} replace />;
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

        <div className="mt-10 grid grid-cols-12 gap-16">
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

        <div className="mt-16 grid grid-cols-12 gap-10">
          <StudentBox />
          <AdultBox />
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-10 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Sprig · A field guide to money</span>
          <span>Anonymous · Free · UK · Ages 13–14</span>
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

        <div className="mt-auto pt-10">
          <div className="h-px w-full bg-border/70" />
          <p className="mt-5 text-[13px] leading-[1.7] text-muted-foreground">
            Don't have an account?{" "}
            <span className="text-foreground">
              Ask your teacher or parent.
            </span>
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
  const navigate = useNavigate();
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
    try {
      const result = await signInWithEmail(email, password);
      if (!result.ok) {
        setError(result.message);
        // Clear the password but keep the email, for the same reason the
        // student form keeps the nickname: it's almost never the wrong half.
        setPassword("");
        return;
      }
      navigate("/teacher", { replace: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="col-span-12 lg:col-span-6">
      <div className="flex h-full flex-col border border-border/70 bg-background/40 p-10">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>II</span>
          <span className="h-px w-6 bg-border" />
          <span>Teacher &nbsp;·&nbsp; Parent</span>
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

        <div className="mt-auto pt-10">
          <div className="h-px w-full bg-border/70" />
          <p className="mt-5 text-[13px] leading-[1.7] text-muted-foreground">
            Teacher accounts are set up for you during the pilot.{" "}
            <span className="text-foreground">Get in touch</span> and we'll make
            you one.
          </p>
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
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        disabled={disabled}
        className="mt-2 w-full border-0 border-b border-border/80 bg-transparent pb-2 font-sans text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-forest focus:outline-none disabled:opacity-60"
      />
    </label>
  );
}

export default Login;
