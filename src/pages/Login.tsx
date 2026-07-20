import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { TopNav } from "@/components/sprig/TopNav";

function Login() {
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

        <form
          className="mt-9 space-y-6"
          onSubmit={(e) => e.preventDefault()}
        >
          <FieldLine label="Nickname" placeholder="e.g. Curious Squirrel" />
          <FieldLine label="PIN" placeholder="4-digit code" type="password" />

          <button
            type="submit"
            className="group mt-2 inline-flex items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-primary-foreground transition-transform group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Continue
              </span>
              <span className="block text-[15px] font-medium text-foreground">
                Log in to your journey
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

function AdultBox() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="col-span-12 lg:col-span-6">
      <div className="flex h-full flex-col border border-border/70 bg-background/40 p-10">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>II</span>
          <span className="h-px w-6 bg-border" />
          <span>Teacher &nbsp;·&nbsp; Parent</span>
        </div>

        {/* Toggle */}
        <div className="mt-6 inline-flex self-start border border-border/70 p-0.5">
          <ToggleBtn
            active={mode === "login"}
            onClick={() => setMode("login")}
          >
            Log in
          </ToggleBtn>
          <ToggleBtn
            active={mode === "signup"}
            onClick={() => setMode("signup")}
          >
            Sign up
          </ToggleBtn>
        </div>

        <h2 className="mt-6 font-display text-[34px] font-normal leading-[1.05] tracking-[-0.03em]">
          {mode === "login" ? (
            <>
              Welcome{" "}
              <em className="font-normal italic text-forest">back</em>.
            </>
          ) : (
            <>
              Grow a{" "}
              <em className="font-normal italic text-forest">classroom</em>.
            </>
          )}
        </h2>

        <p className="mt-4 text-[14px] leading-[1.7] text-muted-foreground">
          {mode === "login"
            ? "Sign in to manage your students, see progress, and assign new nicknames."
            : "Create a free account. Add your class, generate anonymous nicknames, and track progress without collecting student data."}
        </p>

        <form
          className="mt-9 space-y-6"
          onSubmit={(e) => e.preventDefault()}
        >
          {mode === "signup" && (
            <FieldLine label="Name" placeholder="Ms. Bennett" />
          )}
          <FieldLine
            label="Email"
            placeholder="you@school.uk"
            type="email"
          />
          <FieldLine
            label="Password"
            placeholder="At least 8 characters"
            type="password"
          />

          <button
            type="submit"
            className="group mt-2 inline-flex items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-primary-foreground transition-transform group-hover:-translate-y-0.5">
              <ArrowUpRight className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {mode === "login" ? "Continue" : "Create account"}
              </span>
              <span className="block text-[15px] font-medium text-foreground">
                {mode === "login" ? "Log in" : "Sign up"}
              </span>
            </span>
          </button>
        </form>

        <div className="mt-auto pt-10">
          <div className="h-px w-full bg-border/70" />
          <p className="mt-5 text-[13px] leading-[1.7] text-muted-foreground">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-forest"
                >
                  Create an account
                </button>
                .
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-forest"
                >
                  Log in
                </button>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.24em] transition-colors ${
        active
          ? "bg-forest text-primary-foreground"
          : "bg-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FieldLine({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full border-0 border-b border-border/80 bg-transparent pb-2 font-sans text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-forest focus:outline-none"
      />
    </label>
  );
}

export default Login;
