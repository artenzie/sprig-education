# Technical log — 13 August 2026

## What we did today

Financial-literacy content needs real formulas — compound interest,
percentage change, ratios — and `slides.body` had no way to show one as
actual maths rather than a string like `A = P(1 + r)^n` sitting there
unstyled. Today added KaTeX rendering for `$inline$` and `$$block$$` math
inside `text`-type slides, following the same "keep it minimal, branch on
what's already there" spirit as the `code` slide type added two days ago —
but this time the pattern was inline parsing inside an existing type, not a
new one, and getting KaTeX actually working in the browser turned into a
real debugging story worth understanding.

---

## 1. Why inline parsing, not a `slide_type = 'math'`

The `code` slide type exists because a whole slide body sometimes needs to
be preserved *verbatim* — that's the reason it's a separate type at all
(see `TECHNICAL_LOG_Aug11.md`). A formula isn't like that. In real content
a formula sits inside a sentence — "since `$1.05^{10} \approx 1.629$`,
£100 becomes about £162.90" — and a dedicated `math` slide type would force
every explanation to be chopped into text → math → text slides, which
fights the "max 15 minutes" pacing this project is built around for no
real benefit.

This also meant no database migration was needed at all.
`slide_type`'s `check (slide_type in ('text', 'code'))` constraint is
untouched — `text` slides just got smarter about how their existing `body`
string renders. That's also why the `code` branch in `SlideStep` and every
existing `text` slide with no `$` in it needed zero behaviour change: the
parser (next section) returns a body with no `$` as a single unchanged
text segment, so the old `<p>{slide.body}</p>` output is reproduced
exactly, just built through one extra function.

## 2. `parseMathSegments` — turning one string into a sequence of runs

New file `src/lib/parseMath.ts`, same "pure function, no React, no
Supabase" shape as `journey.ts` and `testMastery.ts`. One regex, matching
`$$...$$` before `$...$` so a display formula never gets swallowed as two
separate inline ones:

```ts
const MATH_PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;
```

It walks the body with `matchAll`, emitting `{type: "text"}` for the gaps
between matches and `{type: "inline" | "block"}` for the matches
themselves. Currency in every seed migration so far is written `£`, never
`$digit` — checked with a grep across `supabase/migrations/` before
committing to `$` as the delimiter, so there's no ambiguity between "this
is a formula" and "this is five pounds."

`SlideStep`'s new `renderTextBody` helper (in `Lesson.tsx`, replacing the
old `<p>{slide.body}</p>` in the `text` branch) turns that segment list
into JSX: consecutive `text`/`inline` segments accumulate into one `<p>`
(inline formulas as `<InlineMath>`), and a `block` segment flushes that
paragraph and renders centered on its own line before the next paragraph
resumes — because a block-level `<div>` can't legally nest inside a `<p>`.

## 3. The dependency that looked fine and wasn't

The plan was to use `react-katex` for `<InlineMath>`/`<BlockMath>`, mainly
to avoid hand-writing `dangerouslySetInnerHTML` — there was zero use of it
anywhere in `src/` before today, and `react-katex` encapsulates that
behind a well-known package instead. Its `package.json` peer range
(`react: ">=15.3.2 <20"`) checked out fine for React 19.

What that peer range doesn't show: `react-katex` *depends on* (not peers
with) `katex ^0.16.x`, which doesn't overlap with the `katex@0.18.4` this
session installed directly for its CSS. npm resolves that the only way it
can — a second, nested copy at
`node_modules/react-katex/node_modules/katex@0.16.47`, invisible unless
you go looking. Two real bugs came out of that mismatch:

- **CSS classes stopped matching.** KaTeX 0.18.x prefixes its structural
  classes (`.katex-base`, `.katex-strut`, `.katex-sizing`); 0.16.x doesn't
  (`.base`, `.strut`, `.sizing`). The CSS imported today
  (`katex/dist/katex.min.css`) is the 0.18.4 stylesheet, styled for the
  *new* class names — but `react-katex` was actually rendering with its
  nested 0.16.47, emitting the *old* ones.
- **Parsing itself broke, but only through Vite.** `$1.05^{10} \approx
  1.629$` rendered as literal text — a red "`\a`" followed by five
  separate italic letters spelling "pprox" — which is KaTeX's own
  fallback rendering for a piece of input it failed to parse
  (`throwOnError: false` catches the error and colours the broken part
  instead of crashing, using `errorColor`, red by default). Called the
  exact same way — same nested 0.16.47 module, same options object, same
  string, confirmed byte-for-byte correct via `JSON.stringify` in the
  browser console — directly under Node, it parsed perfectly every time.
  It only broke once that specific module was pulled through Vite's
  dependency pre-bundler (`node_modules/.vite/deps/react-katex.js`, which
  inlines the nested katex rather than giving it its own chunk).

Chasing that down was most of today's work: confirming the string reaching
`InlineMath` was correct (`console.debug` at the exact call site),
confirming KaTeX's own symbol table for `\approx` was intact in the built
chunk (`grep`), confirming the *same nested version* rendered correctly
under plain Node with the exact call signature `react-katex` uses, and
then confirming the *top-level* `katex@0.18.4` rendered the same string
**correctly in that same browser tab** when called directly. That last
test is what pointed at "this is specifically about the nested-copy +
Vite-bundling combination," not the string, not KaTeX itself, not React.

The fix: drop `react-katex` (`npm uninstall`) and write a small local
wrapper — `src/components/sprig/Math.tsx` — calling the app's own
`katex.renderToString` directly:

```tsx
export function InlineMath({ math }: { math: string }) {
  const html = useMemo(() => renderKatex(math, false), [math]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
```

This is the one place this project now uses `dangerouslySetInnerHTML` —
unavoidable, because KaTeX's only supported way to reach the DOM is HTML
it generates itself from a TeX string (never from arbitrary user input;
every value here comes from curriculum content written by the developer).
It also fixes both bugs from the same root cause: one KaTeX version, whose
class names match the CSS actually imported, called in a way that Vite's
bundler doesn't corrupt.

## 4. CSS

`@import 'katex/dist/katex.min.css';` added to `src/index.css`, alongside
the two existing `@import` lines — same pattern, no new mechanism. Vite
resolves the font `url()` references inside that CSS from `node_modules`
automatically; confirmed by watching `KaTeX_Main-Regular.woff2` and
`KaTeX_Math-Italic.woff2` actually load with a 200 in the network panel,
not just assuming a CSS import "worked" because nothing threw.

## 5. Verifying rendering, not just absence of errors

A throwaway route (`/dev/math-preview`, rendering `SlideStep` directly
with mock slide bodies — inline math, a block equation, a math-free text
slide, and a code slide, side by side) let this get checked without
touching Supabase or creating a test student account, since nothing here
needed real data — the goal was to check the *renderer*, not the
database. Screenshotted, zoomed in on the actual glyphs (not just "did it
throw"), and cross-checked against the DOM's `annotation` element (KaTeX's
own MathML fallback, holding the raw TeX it parsed) to catch the exact
mismatch described in section 3. The route, the mock page, and the
temporary `export` added to `SlideStep` to reach it were all removed
before finishing — confirmed by `git status` showing only the real
feature files.

---

## What was verified

| Check | Result |
|---|---|
| `npx tsc -b` across the whole project | clean |
| Inline formula (`$1.05^{10} \approx 1.629$`) renders with a real superscript and the ≈ glyph, not literal text | done, after diagnosing and fixing the react-katex/Vite bug in section 3 |
| Block formula (`$$A = P(1 + r)^n$$`) renders centered on its own line | done |
| A `text` slide with no `$` in it renders identically to the old `<p>{slide.body}</p>` | done |
| `code` slides are visually and functionally untouched | done |
| KaTeX font files (`KaTeX_Main-Regular.woff2`, `KaTeX_Math-Italic.woff2`) load with 200, not 404 | done |
| Zero console errors on the preview route | done |
| No new `npm audit` vulnerabilities introduced by `katex` (compared pre/post install — same 4 pre-existing, unrelated to this change) | done |
| `/lesson` still redirects a signed-out visitor to `/login` with no console errors | done |
| Throwaway preview route, mock page, and temporary `SlideStep` export fully removed before finishing, confirmed by `git status` | done |
