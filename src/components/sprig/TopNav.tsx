import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Compass,
  BookOpen,
  Sprout,
  Award,
  Bell,
  HelpCircle,
  KeyRound,
  LogOut,
  Sparkles,
  CalendarClock,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import type { Student } from "@/context/auth";
import { nicknameInitials } from "@/lib/studentAuth";
import { supabase } from "@/lib/supabase";
import { LeafAvatar } from "@/components/sprig/leafAvatars";
import {
  LEAF_SHAPES,
  LEAF_COLOURS,
  colourToken,
  isLeafShapeId,
  DEFAULT_COLOUR,
} from "@/lib/leafAvatars";

export function TopNav() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { status, student } = useAuth();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) setProfileOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-8">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2.5">
            <SprigMark />
            <span className="flex flex-col leading-none">
              <span className="font-display text-[20px] font-medium tracking-tight text-ink">
                Sprig
              </span>
              <span className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
                by Artem Makarov
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavItem to="/dashboard" icon={<Compass className="h-4 w-4" />} label="Journey" />
            <NavItem to="/progress" icon={<Sprout className="h-4 w-4" />} label="Growth" />
            <NavItem to="/library" icon={<BookOpen className="h-4 w-4" />} label="Library" />
            <NavItem to="/certificate" icon={<Award className="h-4 w-4" />} label="Certificate" />
            <NavItem to="/help" icon={<HelpCircle className="h-4 w-4" />} label="Help" />
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={notifRef}>
            <button
              aria-label="Announcements"
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {/* The unread dot is gone with the fake notifications that
                  justified it. Nothing tracks whether these have been read, so
                  a permanent dot would nag every student forever about two
                  announcements they read on day one. */}
              <Bell className="h-4 w-4" />
            </button>
            {notifOpen && <NotificationsPanel />}
          </div>
          {/* TopNav also renders on public pages, so there may be nobody
              signed in — in which case the avatar becomes a way in. */}
          <div className="relative ml-2" ref={profileRef}>
            {status === "authed" && student ? (
              <>
                <button
                  aria-label="Profile"
                  aria-expanded={profileOpen}
                  onClick={() => {
                    setProfileOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-[13px] font-semibold text-forest transition-colors hover:bg-forest/15"
                >
                  {isLeafShapeId(student.avatar_shape) ? (
                    <LeafAvatar
                      shape={student.avatar_shape}
                      colour={student.avatar_colour}
                      className="h-9 w-9"
                    />
                  ) : (
                    nicknameInitials(student.nickname)
                  )}
                </button>
                {profileOpen && (
                  <ProfilePanel student={student} onClose={() => setProfileOpen(false)} />
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-full border border-border/70 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:border-forest hover:text-foreground"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Announcements, hand-written and the same for everybody.
 *
 * This panel used to hold three invented notifications: a topic unlock that
 * had not happened, a baseline retake that was not waiting, and a live session
 * with Artem on Thursday at 4pm that did not exist. Nothing generated them and
 * nothing could have — there is no notifications table, no unlock event, no
 * schedule.
 *
 * Two honest entries replace them. They are still static, and that is the
 * point: this is an announcements list, not a notification system, and it says
 * only things that are true of every student. Anything per-student (your topic
 * unlocked, your retake is due) needs a real event source and belongs to a
 * later piece of work.
 *
 * `date` is a fixed fact about the announcement, not a relative "2h ago"
 * computed from nothing. Undated entries — things true since the beginning —
 * simply carry no date.
 */
const ANNOUNCEMENTS: { icon: React.ReactNode; title: string; date?: string }[] = [
  {
    icon: <CalendarClock className="h-3.5 w-3.5 text-[color:var(--gold)]" />,
    title: "Mastery (Tier 4) has been added — five new topics in the canopy.",
    date: "14 August 2026",
  },
  {
    icon: <Sparkles className="h-3.5 w-3.5 text-forest" />,
    title: "Welcome to Sprig. Start at the trunk and work upwards.",
  },
];

function NotificationsPanel() {
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[320px] overflow-hidden rounded-xl border border-border/70 bg-background shadow-[0_8px_24px_-16px_rgba(34,41,31,0.25)]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
          Announcements
        </span>
        {/* Not "2 new". Nothing records whether this student has read them, so
            "new" would be a claim the app cannot back up. */}
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/70">
          {ANNOUNCEMENTS.length}
        </span>
      </div>
      <ul>
        {ANNOUNCEMENTS.map((it, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 px-4 py-3 ${
              i < ANNOUNCEMENTS.length - 1 ? "border-b border-border/50" : ""
            } hover:bg-secondary/60`}
          >
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
              {it.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] leading-snug text-foreground">{it.title}</div>
              {it.date && (
                <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                  {it.date}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfilePanel({ student, onClose }: { student: Student; onClose: () => void }) {
  const { signOut, refreshStudent } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  /**
   * Write one half of the avatar.
   *
   * Shape and colour are sent separately — the RPC coalesces a null argument
   * against the stored value, so choosing a colour cannot blank out the shape.
   * The alternative, sending both every time, would mean the picker had to
   * carry a correct local copy of whatever is in the database; this way the
   * database stays the only place the answer lives.
   */
  async function pick(shape: string | null, colour: string | null) {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_avatar_leaf", {
        p_shape: shape,
        p_colour: colour,
      });
      if (!error) await refreshStudent();
    } finally {
      setSaving(false);
    }
  }

  // This panel used to show the PIN behind a reveal toggle. It can't any more,
  // and that's the intended outcome rather than a regression: PINs are now
  // bcrypt-hashed by Supabase, so there is nothing to reveal — not to the
  // student, not to us, not to anyone who gets hold of the database. The cost
  // is that a forgotten PIN has to be reset by a teacher instead of looked up.
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[316px] overflow-hidden rounded-xl border border-border/70 bg-background shadow-[0_8px_24px_-16px_rgba(34,41,31,0.25)]">
      <div className="m-3 overflow-hidden rounded-lg border border-border/60 bg-secondary/60">
        {/* Live preview. Shows the CURRENT pair, so changing either half is
            visible here before it is visible in the nav behind the panel. */}
        <div className="flex h-20 items-center justify-center">
          {isLeafShapeId(student.avatar_shape) ? (
            <LeafAvatar
              shape={student.avatar_shape}
              colour={student.avatar_colour}
              className="h-14 w-14"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest/15 font-display text-[22px] text-forest">
              {nicknameInitials(student.nickname)}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 bg-background/60 p-3">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
            Leaf
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {LEAF_SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                title={shape.label}
                aria-label={`Use the ${shape.label} leaf`}
                aria-pressed={student.avatar_shape === shape.id}
                disabled={saving}
                // Each swatch previews the shape in the colour ALREADY chosen,
                // so the grid shows eight versions of the student's own leaf
                // rather than eight unrelated ones. Picking a shape then
                // changes exactly the thing the button showed.
                onClick={() => pick(shape.id, student.avatar_colour ?? DEFAULT_COLOUR)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                  student.avatar_shape === shape.id
                    ? "ring-2 ring-forest ring-offset-1 ring-offset-background"
                    : "hover:bg-secondary"
                }`}
              >
                <LeafAvatar shape={shape.id} colour={student.avatar_colour} className="h-8 w-8" />
              </button>
            ))}
          </div>

          <div className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
            Colour
          </div>
          <div className="mt-2 flex items-center gap-2">
            {LEAF_COLOURS.map((colour) => (
              <button
                key={colour.id}
                type="button"
                title={colour.label}
                aria-label={`Use ${colour.label}`}
                aria-pressed={student.avatar_colour === colour.id}
                disabled={saving}
                onClick={() => pick(null, colour.id)}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform disabled:opacity-60 ${
                  student.avatar_colour === colour.id
                    ? "ring-2 ring-forest ring-offset-1 ring-offset-background"
                    : "hover:scale-110"
                }`}
              >
                {/* The same ink contour the leaves get, for the same reason:
                    a mint or sage swatch on a cream panel is otherwise a
                    barely-visible disc. */}
                <span
                  className="h-5 w-5 rounded-full border border-ink/70"
                  style={{ backgroundColor: colourToken(colour.id) }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
          Reader
        </div>
        <div className="mt-1 font-display text-[17px] leading-tight text-foreground">
          {student.nickname}
        </div>
      </div>
      <div className="border-t border-border/60">
        <button
          onClick={() => {
            onClose();
            navigate("/set-pin");
          }}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Change PIN
        </button>
      </div>
      <div className="border-t border-border/60">
        <button
          onClick={() => {
            onClose();
            void signOut().then(() => navigate("/"));
          }}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  disabled,
}: {
  to?: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  if (disabled || !to) {
    return (
      <span
        aria-disabled="true"
        title="Coming soon"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-full px-3.5 py-1.5 text-[13.5px] text-muted-foreground/50"
      >
        {icon}
        {label}
        <span className="ml-1 rounded-full border border-border/60 px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Soon
        </span>
      </span>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors hover:bg-secondary hover:text-foreground ${
          isActive ? "bg-forest/10 text-forest" : "text-muted-foreground"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function SprigMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path
        d="M13 22 C 13 14, 8 10, 5 8"
        stroke="var(--forest)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M13 16 C 15 14, 18 13, 21 12"
        stroke="var(--forest)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="4" cy="7" rx="2.4" ry="1.3" transform="rotate(-30 4 7)" fill="var(--forest)" />
      <ellipse cx="21.4" cy="11.6" rx="2.2" ry="1.2" transform="rotate(20 21.4 11.6)" fill="var(--terracotta)" opacity="0.9" />
    </svg>
  );
}
