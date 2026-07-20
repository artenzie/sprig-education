# Technical Log — July 20, 2026

## What we built today

We took a fully-designed UI — Landing, Login, Dashboard (with a hand-drawn journey tree), a Lesson flow, Progress/Tests, Certificate, Library, and an FAQ page — that had been built separately in Lovable, and merged it into this repo. Before today, `sprig` had four placeholder pages that just rendered a label (`<div>Dashboard</div>`, etc.) from the July 16 scaffold. Now every page has its real, finished UI. Nothing is wired to a backend yet — no auth, no database, no saved state — this was purely a visual/structural port.

---

## Two separate codebases, one merge

The Lovable project and this repo were never the same codebase — they were built independently, on different scaffolding, and had never shared a git history. "Porting" here didn't mean `git merge` or `git pull` from another remote; it meant **manually reading the source project and re-authoring its pieces inside our project's structure**, adapting anything that assumed a different setup.

This is a common situation: a designer or a tool like Lovable produces a polished frontend in its own opinionated project shape, and someone then has to lift the *design and behavior* — not the *file-for-file source* — into the project that will actually ship. The steps look like this:

1. **Clone the source and read it end to end before changing anything.** We cloned the Lovable repo to a scratch directory and read every route file, every shared component, the Tailwind theme, and the font setup. Skipping this step is how you end up copying over things you don't need (or missing an adaptation you do need) — see the dependency pruning below.
2. **Identify what's actually load-bearing.** The source's `package.json` listed ~35 dependencies — a full shadcn/ui component library (Radix primitives, `cmdk`, `vaul`, `embla-carousel`, `recharts`, `react-hook-form`, `zod`...), `@tanstack/react-query`, and the TanStack Start SSR framework itself. Grepping the actual page and component files we needed showed **zero** imports from `@/components/ui/*` (the shadcn primitives) and **zero** uses of `react-query` outside the root SSR shell we weren't porting. Every visual element on these 8 pages is hand-built with plain `<div>`/`<svg>`/Tailwind classes, not component-library primitives. So the real dependency delta was two packages: `lucide-react` (icons, used everywhere) and `tw-animate-css` (powers the check-in modal's fade/zoom transition classes). This is the difference between "port everything the source repo has" and "port everything the design actually uses" — the latter is what keeps a codebase lean.
3. **Strip framework-specific scaffolding.** The source used **TanStack Start**, a server-rendering framework — each page file exported a `Route` object via `createFileRoute("/path")({ head: () => ({...}), component: MyPage })`, plus a `routeTree.gen.ts` auto-generated file, a `server.ts`, `nitro` build config, etc. None of that exists in our project, which is a plain client-side Vite + React app. Porting meant deleting that wrapper from every page and keeping just the `function MyPage() { ... }` component underneath, then wiring it up ourselves in our own router.
4. **Reconcile the two projects' conventions.** The source used the `@/` import alias (`@/components/sprig/TopNav`) resolved via TanStack's bundled Vite config. Our `vite.config.ts` had no such alias. Rather than rewrite every import path by hand (error-prone across dozens of files), we added the same alias to *our* config (`resolve.alias` in `vite.config.ts`, plus a matching `paths` entry in `tsconfig.app.json` so the editor/type-checker agrees). This let us copy the source files' import lines unchanged.

---

## The routing decision: what should `/` show?

This was the one real judgment call, not just a mechanical port. In the Lovable source, the root route (`/`) *was* the Dashboard/journey-tree view directly — there was no separate marketing/landing page at all. The closest thing to landing-page copy was a page called `/about`: a founder's-story page with a hero wordmark, a "what Sprig is" section, and a contact block.

Two real options existed:
- **Match the source exactly**: `/` = Dashboard, no landing page, since that's literally what the live Lovable app does.
- **Give the app a proper pre-login landing page**: `/` = the marketing content (from `/about`), move the Dashboard to its own path.

We went with the second: **`/` now serves the Landing page** (built from the source's `/about` content — the twig wordmark, the "what Sprig is" pillars, founder story, contact section), and **the Dashboard/journey-tree view moved to `/dashboard`**. This matches how most apps are actually shaped — an unauthenticated visitor sees marketing copy first, and "the app" (dashboard, lesson, progress, etc.) lives behind its own path — even though the source repo, being a Lovable prototype focused on visual design, hadn't drawn that line yet.

Making this decision correctly required propagating it through every internal link that assumed the old shape: `TopNav`'s "Journey" nav item, the Lesson page's "← Journey" and "Back to your journey" links, and Progress's "← Back to journey" link all used to point at `/` and now point at `/dashboard`.

**Final route table:**

| Route | Page | Source file it came from |
|---|---|---|
| `/` | Landing | `routes/about.tsx` |
| `/login` | Login | `routes/login.tsx` |
| `/dashboard` | Dashboard + journey tree | `routes/index.tsx` |
| `/lesson` | Lesson flow | `routes/lesson.tsx` |
| `/library` | Library | `routes/library.tsx` |
| `/progress` | Progress & Tests | `routes/progress.tsx` |
| `/certificate` | Certificate | `routes/certificate.tsx` |
| `/help` | FAQ | `routes/help.tsx` |

---

## What came over, structurally

```
src/
  pages/
    Landing.tsx        (was routes/about.tsx)
    Login.tsx
    Dashboard.tsx       (was routes/index.tsx)
    Lesson.tsx
    Library.tsx
    Progress.tsx
    Certificate.tsx
    Help.tsx
  components/
    sprig/
      TopNav.tsx        (adapted — see React Router section below)
      JourneyTree.tsx   (copied verbatim — no routing code inside it)
      CheckInModal.tsx  (copied verbatim — no routing code inside it)
  routes/
    AppRoutes.tsx       (our route table, rewritten)
  index.css             (Sprig design system: color tokens, fonts, animations)
```

The `pages/` vs `components/` split is the same convention noted in the July 16 log: a **page** is something a URL points at; a **component** is a reusable piece a page pulls in. `JourneyTree` and `CheckInModal` needed zero changes because they contain no navigation logic at all — they're pure presentation, so they're identical regardless of which router or framework renders them. `TopNav` *does* contain navigation, so it needed the adaptation described next.

**Design system**: the Tailwind v4 theme (color tokens defined as CSS custom properties in oklch color space, the `sprig-glow` pulse animation, the `@theme inline` font mappings) was copied into `src/index.css` almost unchanged. Two Google Fonts — **Fraunces** (a serif display face, used for headings and the italic accent text) and **Manrope** (the sans body face) — were added via `<link>` tags in `index.html`, matching how the source loaded them.

---

## React Router: what changed and why

Our project uses **react-router-dom**, a client-side-only router — the entire app is one HTML page, and navigating between "pages" just swaps out a React component in place, with `<BrowserRouter>` (in `main.tsx`) keeping the visible URL in sync via the browser's History API. No new HTML is ever requested from a server after the first load.

The source's TanStack Start is different: it's a **file-based, SSR-capable** router. Route definitions live in files (`routes/login.tsx` *is* the `/login` route, no separate route table needed), and each route can define server-rendered `<head>` metadata (page title, meta description, Open Graph tags) right next to the component. That `head()` config doesn't have an equivalent in plain react-router-dom, so it was dropped — every page in our app currently shares the one static `<title>` in `index.html`. (If per-page titles matter later, that's normally solved with a small library like `react-helmet-async`, or by calling `document.title = "..."` in a `useEffect`.)

The other concrete adaptation was in `TopNav.tsx`. TanStack's `Link` supports an `activeProps`/`activeOptions` pattern to style a nav link differently when its route is the current one. react-router-dom's equivalent is `NavLink`, which instead takes a function for `className` that receives `{ isActive }`:

```tsx
<NavLink
  to={to}
  className={({ isActive }) =>
    `... ${isActive ? "bg-forest/10 text-forest" : "text-muted-foreground"}`
  }
>
  {icon}{label}
</NavLink>
```

Everywhere else, a plain `Link` from `react-router-dom` is a drop-in replacement for TanStack's `Link` — same `to` prop, same behavior (intercepts the click, updates history, re-renders in place instead of a full page reload).

---

## Verification

Both the type checker (`tsc -b`) and the production bundler (`vite build`) were run clean before calling this done — the build step in particular exercises every file through the real bundler, which catches import/alias mistakes that a quick visual check wouldn't. Every one of the 8 routes was then rendered in a headless browser and screenshotted to confirm the fonts, colors, and layout — including the journey tree's branches, leaves, and milestone markers — actually paint correctly, not just compile.

---

## Where things stand

- All 8 designed pages are live and visually complete: Landing, Login, Dashboard (journey tree), Lesson flow, Library, Progress, Certificate, Help.
- Still static/UI-only by design: no auth, no persisted state, no backend calls. Buttons like "Log in," "Take Growth Check," and "Download PDF" render but don't do anything yet.
- Dependency footprint stayed small — `lucide-react` and `tw-animate-css` were the only additions, because the shadcn/Radix/react-query stack in the source repo turned out to be unused by any of the pages we needed.
- A few source-repo components (`BackgroundLandscape.tsx`, `LessonPath.tsx`, `StatsBar.tsx`) were left behind — they exist in the Lovable repo but aren't referenced by any of its own routes either, so they were dead code there too.
