/**
 * A teacher's view of their class's progress.
 *
 * Two queries, fired together, mirroring the split useJourney.ts already
 * makes for a single student: the curriculum is the same for everyone, and
 * completions are per-student, so they're kept apart rather than joined.
 *
 *   - `topics` (with nested subtopics) — the same curriculum read every
 *     student's dashboard uses.
 *   - `progress` — every completed-subtopic row the CALLING TEACHER is
 *     allowed to see. No `.eq("student_id", ...)` here, deliberately, same
 *     reasoning as useJourney.ts: the RLS policy added in
 *     20260809000000_teacher_read_class_progress.sql already narrows this to
 *     the teacher's own class. Filtering again here would be a second,
 *     weaker copy of a rule the database already enforces.
 *
 * This file deliberately does NOT fetch `students` — TeacherStudents.tsx
 * already has the roster (with lock/PIN state) from fetchTeacherStudents() in
 * teacherAuth.ts, and re-querying it here would be a second, redundant read
 * of the same table. The caller combines this file's per-student completion
 * sets with that existing roster, keyed by student id, and turns each one
 * into a Journey with the SAME deriveJourney() a student's own dashboard
 * uses — no second copy of the tier/percent/unlock rules to keep in sync.
 */

import { supabase } from "@/lib/supabase";
import type { Journey, RawTopic } from "@/lib/journey";

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

export type ClassProgressData = {
  topics: RawTopic[];
  /** subtopic ids completed, keyed by student id. Absent id = no completions. */
  progressByStudentId: Map<string, Set<string>>;
};

export async function fetchClassProgress(): Promise<Result<{ data: ClassProgressData }>> {
  const [topicsResult, progressResult] = await Promise.all([
    supabase.from("topics").select("id,tier,order,title,subtopics(id,order,title)"),
    supabase.from("progress").select("student_id, subtopic_id").eq("status", "complete"),
  ]);

  if (topicsResult.error) return { ok: false, message: topicsResult.error.message };
  if (progressResult.error) return { ok: false, message: progressResult.error.message };

  const progressByStudentId = new Map<string, Set<string>>();
  for (const row of (progressResult.data ?? []) as { student_id: string; subtopic_id: string }[]) {
    const set = progressByStudentId.get(row.student_id) ?? new Set<string>();
    set.add(row.subtopic_id);
    progressByStudentId.set(row.student_id, set);
  }

  return {
    ok: true,
    data: { topics: (topicsResult.data ?? []) as RawTopic[], progressByStudentId },
  };
}

/** Per-topic % of the class that has completed it. Topics with no content are skipped. */
export type ClassTopicCompletion = { id: string; title: string; percent: number };

export function classTopicCompletion(topics: RawTopic[], journeys: Journey[]): ClassTopicCompletion[] {
  const classSize = journeys.length;

  return topics
    .filter((t) => t.subtopics.length > 0)
    .slice()
    .sort((a, b) => a.tier - b.tier || a.order - b.order)
    .map((topic) => {
      const doneCount = journeys.filter(
        (j) => j.topics.find((t) => t.id === topic.id)?.status === "complete",
      ).length;
      return {
        id: topic.id,
        title: topic.title,
        percent: classSize === 0 ? 0 : Math.round((doneCount / classSize) * 100),
      };
    });
}

/** The class's average of each student's own overall percentComplete. */
export function classAverageCompletion(journeys: Journey[]): number {
  if (journeys.length === 0) return 0;
  const sum = journeys.reduce((n, j) => n + j.percentComplete, 0);
  return Math.round(sum / journeys.length);
}
