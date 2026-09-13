import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { fetchHostData, type HostData } from "@/lib/hostData";
import {
  cohortScores,
  freeTextResponses,
  hostOverview,
  journeysByStudent,
  moodBreakdown,
  tierCompletion,
  topicDifficulty,
  weeklyAverages,
} from "@/lib/hostAggregate";
import { HostOverviewPanel } from "@/components/sprig/host/HostOverviewPanel";
import { HostStudentTable } from "@/components/sprig/host/HostStudentTable";
import { HostSatisfaction } from "@/components/sprig/host/HostSatisfaction";
import { HostFeedbackInbox } from "@/components/sprig/host/HostFeedbackInbox";
import { HostContactRequests } from "@/components/sprig/host/HostContactRequests";
import { HostTestPerformance } from "@/components/sprig/host/HostTestPerformance";

/**
 * The host's personal 100%-complete preview student (created 13 Sep 2026).
 * Not the pilot account, which belongs to a school.
 */
const PREVIEW_NICKNAME = "Demo";

/**
 * The whole pilot, on one page.
 *
 * /teacher answers "how is my class doing and can I get this child back in".
 * This answers "is Sprig working" — across every school, including the two
 * questions no teacher can ask: how do students feel about it, and what did
 * they actually get wrong.
 *
 * WHAT MAKES THIS PAGE SAFE IS NOT IN THIS FILE. Every read below is an
 * unqualified select — no `.eq("teacher_id", ...)`, nothing narrowing anything
 * — and what comes back is decided entirely by six RLS policies whose
 * predicate is `public.is_host()`, evaluated in the database against an id
 * taken from a JWT the browser cannot forge. A non-host who forced their way
 * onto this route would render every section below, all of them empty. See
 * supabase/migrations/20260818010000_host_role.sql.
 *
 * All the arithmetic happens here rather than in SQL views, for the same
 * reason teacherProgress.ts gives: completion is computed by the same
 * deriveJourney() a student's own dashboard uses, and mastery by the same
 * latestOutcomes(), so there is no second copy of those rules to drift. That
 * choice is sized for a pilot of roughly ninety students. If Sprig grows past
 * a few hundred, this is the file that should stop doing its own maths.
 */
function HostDashboard() {
  const { teacher, signOut } = useAuth();
  const navigate = useNavigate();

  // A shortcut, not a way in. It ends the host session and opens the ordinary
  // student login with the nickname typed for you — the PIN is still yours to
  // enter, and nothing about what either account can read changes. The
  // nickname travels in router state rather than the URL so it isn't left in
  // the address bar or history.
  async function viewAsStudent() {
    await signOut();
    navigate("/login", { replace: true, state: { nickname: PREVIEW_NICKNAME } });
  }

  const [data, setData] = useState<HostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // React 19's StrictMode mounts effects twice in development; without this
    // guard a slow first response can land after the second and overwrite
    // fresher data with staler data.
    let cancelled = false;
    setLoading(true);

    fetchHostData().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setData(null);
        setError(result.message);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Every derived figure on the page, recomputed only when the data changes.
  // Grouped into one memo rather than eight because they all depend on exactly
  // the same input and splitting them would just be eight dependency arrays
  // that have to stay in agreement.
  const view = useMemo(() => {
    if (!data) return null;

    const journeys = journeysByStudent(data.topics, data.students, data.progressByStudentId);
    const nicknameById = new Map(data.students.map((s) => [s.id, s.nickname]));
    const teachersById = new Map(data.teachers.map((t) => [t.id, t]));

    // Sorted the same way every other topic list in the app is — tier, then
    // order within the tier — so a topic sits in the same place here as it
    // does on a student's own Progress page.
    const orderedTopics = [...data.topics].sort((a, b) => a.tier - b.tier || a.order - b.order);

    return {
      journeys,
      teachersById,
      overview: hostOverview(data.students, data.teachers, journeys),
      tiers: tierCompletion(data.topics, data.students, data.progressByStudentId),
      mood: moodBreakdown(data.daily),
      weekly: weeklyAverages(data.weekly),
      responses: freeTextResponses(data.weekly, data.daily, nicknameById),
      scores: cohortScores(data.attempts),
      difficulty: topicDifficulty(data.attempts, orderedTopics),
    };
  }, [data]);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-10 py-5">
          <span className="font-display text-[19px] font-normal tracking-[-0.02em]">Sprig</span>
          <div className="flex flex-wrap items-center justify-end gap-x-7 gap-y-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
              Host · {teacher?.email}
            </span>
            <button
              onClick={() => void viewAsStudent()}
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
            >
              View as student ({PREVIEW_NICKNAME})
            </button>
            <button
              onClick={() => void signOut()}
              className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-10 pb-24 pt-16">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Host</span>
          <span className="h-px w-8 bg-border" />
          <span>Every school</span>
        </div>

        <h1 className="mt-10 font-display text-[54px] font-normal leading-[1.02] tracking-[-0.035em]">
          Is any of this <em className="font-normal italic text-forest">working</em>?
        </h1>

        <p className="mt-6 max-w-xl text-[15px] leading-[1.75] text-muted-foreground">
          Everything below is read-only and cohort-wide. Teachers still see only their
          own class, and still never see a mood, a score or a written answer — this is
          the one account that does.
        </p>

        {loading ? (
          <p className="mt-16 font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            Loading the whole pilot
          </p>
        ) : error ? (
          <div className="mt-16 border border-border/70 bg-background/40 px-8 py-10">
            <p role="alert" className="text-[13px] leading-[1.6] text-[color:var(--destructive)]">
              {error}
            </p>
            <button
              onClick={reload}
              className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
            >
              Try again
            </button>
          </div>
        ) : !view || !data ? null : (
          <>
            <HostOverviewPanel overview={view.overview} tiers={view.tiers} />

            <HostStudentTable
              students={data.students}
              journeys={view.journeys}
              teachersById={view.teachersById}
              onChanged={reload}
            />

            <HostSatisfaction
              mood={view.mood}
              weekly={view.weekly}
              responses={view.responses}
            />

            <HostFeedbackInbox messages={data.helpMessages} />

            <HostContactRequests requests={data.contactRequests} />

            <HostTestPerformance scores={view.scores} difficulty={view.difficulty} />
          </>
        )}
      </section>
    </div>
  );
}

export default HostDashboard;
