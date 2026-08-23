import type { HostContactRequest } from "@/lib/hostData";
import { Section } from "./HostSection";

/**
 * Adults who left an email address on /login.
 *
 * Shipped in the same change as the form and the table, rather than three
 * weeks later. That is the lesson from `help_messages`, whose migration
 * records the Help box promising a reply within two days while storing
 * nothing, and then sitting behind "There is no inbox UI yet" until the host
 * dashboard existed. A form that says "Artem will get in touch" with nothing
 * reading the rows is the same failure with better wording.
 *
 * Rows arrive from host_contact_requests(), not a table read: `contact_requests`
 * has no grants for any browser role, host included.
 *
 * Deliberately the plainest section on the page — no status, no archive, no
 * "contacted" flag. There is no traffic yet to tell anyone what a useful
 * workflow would look like, and a status field invented before the first real
 * request is a field that gets left stale.
 */
export function HostContactRequests({ requests }: { requests: HostContactRequest[] }) {
  return (
    <Section
      label="Contact requests"
      summary={
        requests.length === 0
          ? "—"
          : `${requests.length} address${requests.length === 1 ? "" : "es"}`
      }
    >
      {requests.length === 0 ? (
        <div className="px-8 py-10">
          <p className="text-[14.5px] leading-[1.7] text-foreground">Nothing yet.</p>
          <p className="mt-3 max-w-lg text-[13.5px] leading-[1.7] text-muted-foreground">
            These come from the strip at the bottom of the login page, where a
            teacher, parent or school can leave an address. It is not a signup —
            nothing here has an account, and replying means emailing them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {requests.map((request) => (
            <li key={request.id} className="px-8 py-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <span>{formatWhen(request.created_at)}</span>
              </div>
              {/* A mailto, because replying by email is the entire point of
                  the row and the address is the only way to do it. */}
              <a
                href={`mailto:${request.email}`}
                className="mt-2 inline-block text-[15px] leading-[1.6] text-forest underline decoration-forest/40 underline-offset-4 transition-colors hover:decoration-forest"
              >
                {request.email}
              </a>
              {request.message && (
                <p className="mt-2 whitespace-pre-line text-[14px] leading-[1.75] text-muted-foreground">
                  {request.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * "20 Aug 2026, 14:32" — the same real timestamp the feedback inbox uses, and
 * for the same reason: "2 days ago" is friendlier and loses the thing that
 * makes a request actionable, which is how long someone has been waiting.
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
