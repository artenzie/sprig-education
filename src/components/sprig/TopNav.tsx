import { Link, NavLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Compass,
  BookOpen,
  Sprout,
  Award,
  Bell,
  HelpCircle,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  CalendarClock,
  CircleDot,
} from "lucide-react";

export function TopNav() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-terracotta" />
            </button>
            {notifOpen && <NotificationsPanel />}
          </div>
          <div className="relative ml-2" ref={profileRef}>
            <button
              aria-label="Profile"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-[13px] font-semibold text-forest transition-colors hover:bg-forest/15"
            >
              AK
            </button>
            {profileOpen && <ProfilePanel />}
          </div>
        </div>
      </div>
    </header>
  );
}

function NotificationsPanel() {
  const items = [
    {
      icon: <Sparkles className="h-3.5 w-3.5 text-forest" />,
      title: "New topic unlocked: Percentages in Real Life",
      time: "2h ago",
    },
    {
      icon: <CircleDot className="h-3.5 w-3.5 text-terracotta" />,
      title: "Your baseline test is ready to retake",
      time: "Yesterday",
    },
    {
      icon: <CalendarClock className="h-3.5 w-3.5 text-[color:var(--gold)]" />,
      title: "Upcoming live session with Artem — Thursday 4pm",
      time: "3d",
    },
  ];
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[320px] overflow-hidden rounded-xl border border-border/70 bg-background shadow-[0_8px_24px_-16px_rgba(34,41,31,0.25)]">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
          Notifications
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-forest">
          {items.length} new
        </span>
      </div>
      <ul>
        {items.map((it, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 px-4 py-3 ${
              i < items.length - 1 ? "border-b border-border/50" : ""
            } hover:bg-secondary/60`}
          >
            <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
              {it.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] leading-snug text-foreground">{it.title}</div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                {it.time}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfilePanel() {
  const [revealed, setRevealed] = useState(false);
  const pin = "4728";
  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[280px] overflow-hidden rounded-xl border border-border/70 bg-background shadow-[0_8px_24px_-16px_rgba(34,41,31,0.25)]">
      <div className="relative m-3 h-28 overflow-hidden rounded-lg border border-border/60 bg-secondary/60">
        {/* placeholder avatar backdrop */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-forest/15 font-display text-[22px] text-forest">
            AK
          </div>
        </div>
        <button className="absolute bottom-2 right-2 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground">
          Customize
        </button>
      </div>
      <div className="px-4 pb-3">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
          Reader
        </div>
        <div className="mt-1 font-display text-[17px] leading-tight text-foreground">
          Curious Squirrel
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground">
              PIN
            </div>
            <div className="mt-0.5 font-mono text-[15px] tracking-[0.3em] text-foreground">
              {revealed ? pin : "••••"}
            </div>
          </div>
          <button
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide PIN" : "Show PIN"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="border-t border-border/60">
        <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
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
