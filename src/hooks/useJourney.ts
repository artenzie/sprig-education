import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { deriveJourney, EMPTY_JOURNEY, type Journey, type RawTopic } from "@/lib/journey";

/**
 * Loads the curriculum and the signed-in student's completions, and hands back
 * the derived journey.
 *
 * Two queries rather than one join, on purpose: the curriculum is the same for
 * everyone and the completions are per-student, so keeping them apart makes it
 * obvious which half is personal data. They're fired together with
 * Promise.all, so it costs one round trip either way.
 */
export function useJourney(): { journey: Journey; loading: boolean; error: string | null; reload: () => void } {
  const { student } = useAuth();
  const studentId = student?.id ?? null;

  const [journey, setJourney] = useState<Journey>(EMPTY_JOURNEY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the effect. Used by reload() after a lesson writes a
  // completion, so the tree reflects it without a full page navigation.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // The same cancellation guard used in Lesson.tsx and Topic.tsx: React 19
    // StrictMode double-mounts in development, and a student can navigate away
    // mid-flight. Without this, a slow response can land after unmount.
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      const [topicsResult, progressResult] = await Promise.all([
        supabase.from("topics").select("id,tier,order,title,subtopics(id,order,title)"),
        // No .eq("student_id", ...) here, and that is not an oversight. The RLS
        // policy added in 20260725010000 restricts this table to
        // auth.uid() = student_id, so the database has already narrowed it to
        // this student. Filtering again in the client would be a comment, not
        // a control -- and would imply the safety came from the query.
        studentId
          ? supabase.from("progress").select("subtopic_id").eq("status", "complete")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      if (topicsResult.error) {
        setError(topicsResult.error.message);
        setLoading(false);
        return;
      }
      if (progressResult.error) {
        setError(progressResult.error.message);
        setLoading(false);
        return;
      }

      const completedIds = new Set(
        (progressResult.data ?? []).map((row) => (row as { subtopic_id: string }).subtopic_id),
      );
      setJourney(deriveJourney((topicsResult.data ?? []) as RawTopic[], completedIds));
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId, nonce]);

  return { journey, loading, error, reload };
}

/**
 * Record that a student finished a subtopic.
 *
 * `ignoreDuplicates` compiles to Postgres's ON CONFLICT DO NOTHING, which is
 * what makes redoing a lesson harmless: the original completed_at survives
 * instead of jumping to today. That matters as soon as anything reads those
 * dates -- a streak or a "finished on" label would otherwise rewrite history
 * every time a student revisited an old lesson to revise.
 *
 * It also means only the INSERT policy is exercised, never UPDATE.
 *
 * Failure is returned rather than thrown. A student who has just answered the
 * last question should never be shown a stack trace because the write lost a
 * race with a flaky connection -- the caller decides how loud to be.
 */
export async function markSubtopicComplete(
  studentId: string,
  subtopicId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("progress").upsert(
    {
      student_id: studentId,
      subtopic_id: subtopicId,
      status: "complete",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,subtopic_id", ignoreDuplicates: true },
  );

  return error ? { ok: false, message: error.message } : { ok: true };
}
