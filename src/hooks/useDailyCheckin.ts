import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { todayKey } from "@/lib/day";

export type Mood = "sad" | "meh" | "happy";

export interface DailyCheckinInput {
  mood: Mood;
  note: string;
}

/**
 * Whether the signed-in student has already checked in today, plus the write.
 *
 * A deliberate near-copy of useWeeklyCheckin -- same shape, smaller scope. The
 * duplication is the cheaper option here: the two differ in their key
 * (`date` vs `week`), their table, and their payload, so a shared abstraction
 * would be three parameters of configuration wrapping four lines of query.
 *
 * "Due" is row presence for todayKey(), not a hours-since-last-checkin
 * calculation. The schema already keys the table on (student_id, date), so
 * that is the unit the hook uses too, and "one per calendar day" needs no
 * separate enforcement -- the primary key is the enforcement.
 */
export function useDailyCheckin(): {
  dueToday: boolean;
  loading: boolean;
  submit: (input: DailyCheckinInput) => Promise<{ ok: true } | { ok: false; message: string }>;
} {
  const { student } = useAuth();
  const studentId = student?.id ?? null;

  const [dueToday, setDueToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!studentId) {
      setDueToday(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    async function load() {
      // No .eq("student_id", ...): the RLS policy already restricts this table
      // to auth.uid() = student_id, same reasoning as useWeeklyCheckin and the
      // progress query in useJourney.
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("date")
        .eq("date", todayKey())
        .maybeSingle();

      if (cancelled) return;
      // An error means we could not find out. Treating that as "not due" is the
      // safe direction: the student sees the resting state instead of being
      // asked a question whose answer we already have but failed to read.
      setDueToday(!error && !data);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const submit = useCallback(
    async (input: DailyCheckinInput) => {
      if (!studentId) return { ok: false as const, message: "Not signed in." };

      // upsert rather than insert, so a student who opens the modal twice in
      // one day updates their answer instead of hitting a primary-key violation
      // they cannot act on.
      const { error } = await supabase.from("daily_checkins").upsert(
        {
          student_id: studentId,
          date: todayKey(),
          mood: input.mood,
          note: input.note.trim() || null,
        },
        { onConflict: "student_id,date" },
      );

      if (error) return { ok: false as const, message: error.message };

      setDueToday(false);
      return { ok: true as const };
    },
    [studentId],
  );

  return { dueToday, loading, submit };
}
