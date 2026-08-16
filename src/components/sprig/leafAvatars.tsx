import { resolveColour, resolveShape, type LeafShape } from "@/lib/leafAvatars";

// Rendering only. The leaf list, the colour list and the validators live in
// src/lib/leafAvatars.ts — see the note at the top of that file for why they
// are not in here.

/**
 * Draw one leaf.
 *
 * THE OUTLINE IS THE POINT OF THIS COMPONENT'S CURRENT SHAPE. The original
 * drew the blade in the leaf's own colour: a 22%-opacity fill under a 1.4px
 * stroke, same colour for both. That is fine for forest (lightness 0.56) and
 * invisible for mint (0.9) and sage (0.82) against a 0.975-lightness cream
 * background — a pale green line on pale green paper. Half the palette could
 * not be seen at all, which is a poor advertisement for a colour picker.
 *
 * So every leaf now gets a dark contour underneath, drawn in --ink (0.26)
 * rather than pure black: it reads as black, and it is the near-black the rest
 * of Sprig already uses. The coloured stroke sits ON TOP of it at a narrower
 * width, so the colour still reads as the leaf's own and the ink shows only as
 * a fine edge. The result is legible on cream, on white and on the mint-tinted
 * panels, which is the whole requirement.
 */
function Blade({ shape, colour }: { shape: LeafShape; colour: string }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" aria-hidden>
      {/* Contour first, wider, so it survives as an edge under the colour. */}
      <path
        d={shape.d}
        fill="color-mix(in oklab, var(--ink) 6%, transparent)"
        stroke="var(--ink)"
        strokeWidth={2.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={shape.d}
        fill={`color-mix(in oklab, ${colour} 34%, transparent)`}
        stroke={colour}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {shape.vein && (
        <path
          d={shape.vein}
          stroke="var(--ink)"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.55}
        />
      )}
    </svg>
  );
}

/**
 * A student's avatar.
 *
 * Shape and colour are stored independently and are independently nullable, so
 * "picked a shape but not yet a colour" is a real state, and it is filled in
 * with a default rather than refused. Callers that want the initials fallback
 * instead should check `isLeafShapeId(student.avatar_shape)` first — a student
 * who has chosen nothing at all should get their initials, not a default leaf
 * that looks like a choice they did not make.
 */
export function LeafAvatar({
  shape,
  colour,
  className = "h-9 w-9",
}: {
  shape: string | null | undefined;
  colour: string | null | undefined;
  className?: string;
}) {
  const resolvedShape = resolveShape(shape);
  const resolvedColour = resolveColour(colour);

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-forest/10 p-1.5 ${className}`}
      aria-label={`${resolvedColour.label} ${resolvedShape.label} avatar`}
    >
      <Blade shape={resolvedShape} colour={resolvedColour.token} />
    </div>
  );
}
