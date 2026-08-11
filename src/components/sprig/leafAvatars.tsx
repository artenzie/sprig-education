// Curated set of pickable profile-avatar leaves. Each option is a fixed
// shape + color pairing (not an independent shape picker crossed with a
// color picker) — species and palette both vary across the set. Ids here
// are mirrored server-side by the `avatar_leaf` CHECK constraint and the
// `set_avatar_leaf` RPC (see the Aug 2026 migration), so renaming one here
// means a matching migration, not just a client edit.

export type LeafAvatarId =
  | "maple-forest"
  | "oak-mint"
  | "birch-terracotta"
  | "willow-gold"
  | "ivy-forest"
  | "fern-mint"
  | "ginkgo-terracotta"
  | "clover-gold";

type LeafOption = {
  id: LeafAvatarId;
  label: string;
  render: () => React.ReactNode;
};

// Same line-art convention as JourneyTree's Leaf() and TopNav's SprigMark:
// a soft color-mix fill under a slightly heavier stroke, plus a thin vein.
function blade(color: string, d: string, vein: string) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d={d}
        fill={`color-mix(in oklab, ${color} 22%, transparent)`}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d={vein} stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}

export const LEAF_AVATARS: LeafOption[] = [
  {
    id: "maple-forest",
    label: "Maple",
    render: () =>
      blade(
        "var(--forest)",
        "M16 4 C22 8, 24 16, 16 28 C8 16, 10 8, 16 4 Z",
        "M16 6 L16 26",
      ),
  },
  {
    id: "oak-mint",
    label: "Oak",
    render: () =>
      blade(
        "var(--mint)",
        "M16 5 C19 6.5, 19 9.5, 22 11.5 C19.5 13.5, 21.5 17, 19 19 C21 22, 17.5 26, 16 29 C14.5 26, 11 22, 13 19 C10.5 17, 12.5 13.5, 10 11.5 C13 9.5, 13 6.5, 16 5 Z",
        "M16 7 L16 27",
      ),
  },
  {
    id: "birch-terracotta",
    label: "Birch",
    render: () =>
      blade(
        "var(--terracotta)",
        "M16 6 C21 10, 21 20, 16 26 C11 20, 11 10, 16 6 Z",
        "M16 8 L16 24",
      ),
  },
  {
    id: "willow-gold",
    label: "Willow",
    render: () =>
      blade(
        "var(--gold)",
        "M16 3 C18 9, 18.5 21, 16 29 C13.5 21, 14 9, 16 3 Z",
        "M16 5 L16 27",
      ),
  },
  {
    id: "ivy-forest",
    label: "Ivy",
    render: () =>
      blade(
        "var(--forest)",
        "M16 8 C13 4, 7 6, 8 12 C8.5 17, 13 20, 16 26 C19 20, 23.5 17, 24 12 C25 6, 19 4, 16 8 Z",
        "M16 10 L16 24",
      ),
  },
  {
    id: "fern-mint",
    label: "Fern",
    render: () =>
      blade(
        "var(--mint)",
        "M16 4 C17.5 10, 17.5 22, 16 29 C14.5 22, 14.5 10, 16 4 Z M16 9 L11 7 M16 13 L21 11 M16 17 L11 15 M16 21 L21 19",
        "M16 6 L16 27",
      ),
  },
  {
    id: "ginkgo-terracotta",
    label: "Ginkgo",
    render: () =>
      blade(
        "var(--terracotta)",
        "M16 27 C9 23, 7 15, 10 8 C12 11, 14 12.5, 16 12.5 C18 12.5, 20 11, 22 8 C25 15, 23 23, 16 27 Z",
        "M16 13 L16 25",
      ),
  },
  {
    id: "clover-gold",
    label: "Clover",
    render: () =>
      blade(
        "var(--gold)",
        "M16 16 C16 11, 12 8, 9 10 C7 13, 9 17, 13 17 C10 19, 9 24, 13 25 C16 26, 16 21, 16 16 C16 21, 16 26, 19 25 C23 24, 22 19, 19 17 C23 17, 25 13, 23 10 C20 8, 16 11, 16 16 Z",
        "",
      ),
  },
];

const LEAF_BY_ID = new Map(LEAF_AVATARS.map((leaf) => [leaf.id, leaf]));

export function isLeafAvatarId(value: string | null | undefined): value is LeafAvatarId {
  return !!value && LEAF_BY_ID.has(value as LeafAvatarId);
}

export function LeafAvatar({
  id,
  className = "h-9 w-9",
}: {
  id: LeafAvatarId;
  className?: string;
}) {
  const leaf = LEAF_BY_ID.get(id);
  if (!leaf) return null;
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-forest/10 p-1.5 ${className}`}
      aria-label={`${leaf.label} avatar`}
    >
      {leaf.render()}
    </div>
  );
}
