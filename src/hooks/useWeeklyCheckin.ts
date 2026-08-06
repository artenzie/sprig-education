import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { currentWeekStart } from "@/lib/week";

export interface WeeklyCheckinInput {
  confidence: number; // 1-5
  completion: number; // 0 = not really, 1 = some, 2 = yes all
  confusedBy: string;
  likedMost: string;
}

/**
 * Whether the signed-in student still owes this week's check-in, plus the
 * write. "Due" is decided by row presence for `currentWeekStart()` rather
 * than a days-since-last-submission calculation -- the schema already keys
 * the table on `(student_id, week)`, so that's the unit this hook uses too.
 */
export function useWeeklyCheckin(): {
  dueThisWeek: boolean;
  loading: boolean;
  submit: (input: WeeklyCheckinInput) => Promise<{ ok: true } | { ok: false; message: string }>;
} {
  const { student } = useAuth();
  const studentId = student?.id ?? null;

  const [dueThisWeek, setDueThisWeek] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!studentId) {
      setDueThisWeek(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    async function load() {
      // No .eq("student_id", ...): the RLS policy already restricts this
      // table to auth.uid() = student_id, same reasoning as the progress
      // query in useJourney.
      const { data, error } = await supabase
        .from("weekly_checkins")
        .select("week")
        .eq("week", currentWeekStart())
        .maybeSingle();

      if (cancelled) return;
      setDueThisWeek(!error && !data);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const submit = useCallback(
    async (input: WeeklyCheckinInput) => {
      if (!studentId) return { ok: false as const, message: "Not signed in." };

      const { error } = await supabase.from("weekly_checkins").upsert(
        {
          student_id: studentId,
          week: currentWeekStart(),
          confidence: input.confidence,
          completion: input.completion,
          confused_by: input.confusedBy.trim() || null,
          liked_most: input.likedMost.trim() || null,
        },
        { onConflict: "student_id,week" },
      );

      if (error) return { ok: false as const, message: error.message };

      setDueThisWeek(false);
      return { ok: true as const };
    },
    [studentId],
  );

  return { dueThisWeek, loading, submit };
}
