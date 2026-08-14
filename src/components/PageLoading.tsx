/** Shared gap-filler for anything that takes a moment to resolve — an auth
 * check, a lazy-loaded route chunk. Same visual as the old RequireAuth-only
 * AuthPending, now reusable as a Suspense fallback too. */
export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-forest sprig-glow" />
        <span>{label}</span>
      </div>
    </div>
  );
}
