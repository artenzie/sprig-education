// The pickable avatar leaves: a SHAPE crossed with a COLOUR.
//
// This started as eight fixed shape+colour pairings ('maple-forest',
// 'oak-mint'), on the theory that a curated look beats an assemble-your-own
// kit. Eight options turned out to be too few to feel like customization at
// all, and the ids were already spelled `shape-colour` -- the cross product,
// enumerated by hand. Splitting them gives 48 combinations from 14 values.
//
// Both lists are mirrored server-side by the `avatar_shape` / `avatar_colour`
// CHECK constraints and the `set_avatar_leaf` RPC (see
// supabase/migrations/20260818000000_split_avatar_shape_and_colour.sql), so
// adding or renaming one here means a matching migration, not just a client
// edit.
//
// WHY THIS IS A .ts FILE AND NOT PART OF THE COMPONENT. A module that exports
// both a component and other values breaks React Fast Refresh -- the same
// reason src/context/auth.ts is split out from AuthProvider.tsx. The old
// version of this file exported the leaf list, a validator and a component
// together and drew a lint warning for it; growing the data was the moment to
// stop carrying that.

export type LeafShapeId =
  | "maple"
  | "oak"
  | "birch"
  | "willow"
  | "ivy"
  | "fern"
  | "ginkgo"
  | "clover";

export type LeafColourId = "forest" | "sage" | "mint" | "terracotta" | "gold" | "bark";

export type LeafShape = {
  id: LeafShapeId;
  label: string;
  /** Outline of the blade, on a 32x32 viewBox. */
  d: string;
  /** The central vein, drawn thinner. Empty for shapes that read better without one. */
  vein: string;
};

export type LeafColour = {
  id: LeafColourId;
  label: string;
  /** A design-system token from the palette block in src/index.css. */
  token: string;
};

export const LEAF_SHAPES: LeafShape[] = [
  {
    id: "maple",
    label: "Maple",
    d: "M16 4 C22 8, 24 16, 16 28 C8 16, 10 8, 16 4 Z",
    vein: "M16 6 L16 26",
  },
  {
    id: "oak",
    label: "Oak",
    d: "M16 5 C19 6.5, 19 9.5, 22 11.5 C19.5 13.5, 21.5 17, 19 19 C21 22, 17.5 26, 16 29 C14.5 26, 11 22, 13 19 C10.5 17, 12.5 13.5, 10 11.5 C13 9.5, 13 6.5, 16 5 Z",
    vein: "M16 7 L16 27",
  },
  {
    id: "birch",
    label: "Birch",
    d: "M16 6 C21 10, 21 20, 16 26 C11 20, 11 10, 16 6 Z",
    vein: "M16 8 L16 24",
  },
  {
    id: "willow",
    label: "Willow",
    d: "M16 3 C18 9, 18.5 21, 16 29 C13.5 21, 14 9, 16 3 Z",
    vein: "M16 5 L16 27",
  },
  {
    id: "ivy",
    label: "Ivy",
    d: "M16 8 C13 4, 7 6, 8 12 C8.5 17, 13 20, 16 26 C19 20, 23.5 17, 24 12 C25 6, 19 4, 16 8 Z",
    vein: "M16 10 L16 24",
  },
  {
    id: "fern",
    label: "Fern",
    d: "M16 4 C17.5 10, 17.5 22, 16 29 C14.5 22, 14.5 10, 16 4 Z M16 9 L11 7 M16 13 L21 11 M16 17 L11 15 M16 21 L21 19",
    vein: "M16 6 L16 27",
  },
  {
    id: "ginkgo",
    label: "Ginkgo",
    d: "M16 27 C9 23, 7 15, 10 8 C12 11, 14 12.5, 16 12.5 C18 12.5, 20 11, 22 8 C25 15, 23 23, 16 27 Z",
    vein: "M16 13 L16 25",
  },
  {
    id: "clover",
    label: "Clover",
    d: "M16 16 C16 11, 12 8, 9 10 C7 13, 9 17, 13 17 C10 19, 9 24, 13 25 C16 26, 16 21, 16 16 C16 21, 16 26, 19 25 C23 24, 22 19, 19 17 C23 17, 25 13, 23 10 C20 8, 16 11, 16 16 Z",
    vein: "",
  },
];

// These point at the --leaf-* tokens rather than the palette tokens of the
// same name. The long note beside them in src/index.css explains why: a token
// tuned to work as a tinted panel background is not automatically a colour you
// can draw a small leaf with, and --mint and --sage were both cases of that.
//
// The ids below are load-bearing beyond this file. They are written into
// students.avatar_colour and pinned by students_avatar_colour_check plus a
// second check inside set_avatar_leaf(), so adding, removing or renaming one
// needs a migration alongside the edit. Labels and tokens are client-side only
// and can change freely.
export const LEAF_COLOURS: LeafColour[] = [
  { id: "forest", label: "Forest", token: "var(--leaf-forest)" },
  { id: "sage", label: "Sage", token: "var(--leaf-sage)" },
  { id: "mint", label: "Mint", token: "var(--leaf-mint)" },
  { id: "terracotta", label: "Terracotta", token: "var(--leaf-terracotta)" },
  { id: "gold", label: "Gold", token: "var(--leaf-gold)" },
  { id: "bark", label: "Bark", token: "var(--leaf-bark)" },
];

export const DEFAULT_SHAPE: LeafShapeId = "maple";
export const DEFAULT_COLOUR: LeafColourId = "forest";

const SHAPE_BY_ID = new Map(LEAF_SHAPES.map((s) => [s.id, s]));
const COLOUR_BY_ID = new Map(LEAF_COLOURS.map((c) => [c.id, c]));

export function isLeafShapeId(value: string | null | undefined): value is LeafShapeId {
  return !!value && SHAPE_BY_ID.has(value as LeafShapeId);
}

export function isLeafColourId(value: string | null | undefined): value is LeafColourId {
  return !!value && COLOUR_BY_ID.has(value as LeafColourId);
}

/** The shape for an id, falling back to the default rather than to nothing. */
export function resolveShape(id: string | null | undefined): LeafShape {
  return SHAPE_BY_ID.get((id ?? DEFAULT_SHAPE) as LeafShapeId) ?? SHAPE_BY_ID.get(DEFAULT_SHAPE)!;
}

/** The colour for an id, falling back to the default rather than to nothing. */
export function resolveColour(id: string | null | undefined): LeafColour {
  return (
    COLOUR_BY_ID.get((id ?? DEFAULT_COLOUR) as LeafColourId) ?? COLOUR_BY_ID.get(DEFAULT_COLOUR)!
  );
}

/** The raw CSS colour for a colour id — used by the picker's swatches. */
export function colourToken(id: string | null | undefined): string {
  return resolveColour(id).token;
}
