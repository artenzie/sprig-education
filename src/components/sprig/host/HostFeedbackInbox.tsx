import type { HostHelpMessage } from "@/lib/hostData";
import { Section } from "./HostSection";

/**
 * The help messages, finally read by somebody.
 *
 * /help has told people "a real person reads every one" while
 * `help_messages` had no reader at all — RLS on, no policies, no grants, and
 * no inbox UI anywhere (20260817000000 says so in as many words: "There is no
 * inbox UI yet"). Until now the only way to see one was a local script or the
 * Supabase dashboard. This section is what makes that sentence true.
 *
 * The rows arrive from host_help_messages(), not from a table read: the table
 * itself stays ungranted and unreachable from every browser, host included.
 * See the long comment on that function in
 * supabase/migrations/20260818020000_host_tools.sql for why an ordinary policy
 * would have been a wider change than it looks.
 *
 * Nothing here can reply, resolve, tag or archive. A message from a 13-year-old
 * who cannot log in needs an answer through their teacher, not a status field
 * — and inventing a workflow before there is any traffic to justify it is how
 * you end up maintaining one nobody uses.
 */
export function HostFeedbackInbox({ messages }: { messages: HostHelpMessage[] }) {
  return (
    <Section
      label="Feedback inbox"
      summary={
        messages.length === 0
          ? "—"
          : `${messages.length} message${messages.length === 1 ? "" : "s"}`
      }
    >
      {messages.length === 0 ? (
        <div className="px-8 py-10">
          <p className="text-[14.5px] leading-[1.7] text-foreground">Nothing yet.</p>
          <p className="mt-3 max-w-lg text-[13.5px] leading-[1.7] text-muted-foreground">
            These come from the contact box on /help, which anyone can use —
            signed in or not. An unsigned message shows as anonymous because
            there is genuinely nobody attached to it, not because the name was
            hidden.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {messages.map((message) => (
            <li key={message.id} className="px-8 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {/* Null covers two different cases that look the same from
                    here — nobody was signed in, or the sender's account has
                    since been deleted (help_messages.student_id is ON DELETE
                    SET NULL, deliberately, so an unanswered question outlives
                    the account that asked it). */}
                <span className="text-forest">{message.nickname ?? "Anonymous"}</span>
                <span>{formatWhen(message.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-line text-[14.5px] leading-[1.75] text-foreground">
                {message.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * "18 Aug 2026, 14:32" — a real timestamp rather than "2 days ago".
 *
 * Relative times are friendlier and wrong for this list: knowing a message
 * arrived during Tuesday's lesson rather than at the weekend is most of what
 * makes it actionable.
 */
function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
