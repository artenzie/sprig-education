# Technical Log — July 16, 2026

## What we built today

We took the `sprig` repo from an empty README to a working front-end scaffold: a Vite-powered React + TypeScript project styled with Tailwind CSS, wired up with client-side routing, organized into a clean folder structure, and branded with a custom favicon. Nothing is "built" in the sense of features yet — this is the skeleton everything else will hang off of.

---

## The pieces, explained

### Vite — the build tool

Vite is what turns your TypeScript/JSX source code into something a browser can actually run, and it's also the local dev server. When you run `npm run dev`, Vite starts a server that serves your app and instantly refreshes the browser whenever you save a file (this is called Hot Module Replacement). Compare that to older tools like Create React App, which could take many seconds to rebuild on every save — Vite does it near-instantly because it only reprocesses the files that changed, not the whole app.

`vite.config.ts` is where Vite is configured:

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

The `react()` plugin teaches Vite how to handle JSX/TSX files. The `tailwindcss()` plugin lets Tailwind's CSS engine hook directly into the build.

### React — the UI library

React lets you build a UI out of small, reusable pieces called **components**. Each component is just a function that returns some markup (JSX — HTML-looking syntax embedded in JavaScript/TypeScript). For example:

```tsx
function Landing() {
  return <div>Landing</div>
}
```

This is a component called `Landing`. Right now it just renders a placeholder `<div>`, but this is where the actual landing page UI will eventually go.

### TypeScript — JavaScript with safety rails

TypeScript is JavaScript with a type system layered on top. It catches a category of bugs (like calling a function with the wrong kind of value) *before* you ever run the code, right in your editor. Every file here ends in `.ts` or `.tsx` (the `x` meaning "this file contains JSX/markup"). The `tsconfig.json` files configure how strict that checking is.

### Tailwind CSS — utility-first styling

Instead of writing custom CSS files with class names like `.card-header`, Tailwind gives you small pre-built utility classes you compose directly in your markup, e.g. `class="flex items-center gap-2 text-green-700"`. The entire setup for it right now is one line in `src/index.css`:

```css
@import 'tailwindcss';
```

That single import pulls in Tailwind's whole engine via the Vite plugin — no separate config file needed for the version installed here (Tailwind v4 simplified this a lot compared to v3).

### React Router — client-side navigation

Normally, a browser reloads the entire page from the server every time you click a link to a new URL. In a single-page app (SPA), we avoid that: React Router intercepts navigation and swaps components in and out without a full page reload, which feels instant.

Three pieces work together to make this happen:

**1. `main.tsx`** wraps the whole app in a `<BrowserRouter>`, which turns on URL-aware routing for everything inside it:

```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

**2. `App.tsx`** is intentionally trivial — it just renders `<AppRoutes />`. Keeping `App` this thin means the routing logic lives in one dedicated place instead of being tangled into the app's root component.

**3. `routes/AppRoutes.tsx`** is the actual route table — it maps URL paths to the component that should render for each:

```tsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/lesson/:id" element={<Lesson />} />
</Routes>
```

The last one, `/lesson/:id`, has a **dynamic segment** (`:id`). Visiting `/lesson/42` renders the `Lesson` component and makes `"42"` available inside it via the `useParams()` hook:

```tsx
function Lesson() {
  const { id } = useParams()
  return <div>Lesson {id}</div>
}
```

This is the pattern you'd use for anything keyed by an ID — a specific lesson, a specific user profile, etc. — one component definition serves infinite URLs.

### Folder structure

```
src/
  pages/        one file per route/screen (Landing, Login, Dashboard, Lesson)
  components/   reusable pieces shared across pages (empty for now, just scaffolded)
  routes/       the route table (AppRoutes.tsx) tying paths to pages
```

The distinction between `pages` and `components` is a common convention: a **page** is something a URL points at directly; a **component** is a smaller reusable building block (a button, a card, a nav bar) that multiple pages might use. Separating them keeps the "what does this URL show" question (routes/pages) separate from "what are our reusable UI building blocks" question (components) as the app grows.

### The favicon

The default Vite/React scaffold ships the Vite logo as the favicon. We replaced it with a custom hand-drawn SVG icon representing a sprig (a small shoot/twig) — a plant stem with three small leaf branches, drawn in a forest green (`#3F7A5C`):

```svg
<svg viewBox="0 0 48 48" fill="none" stroke="#3F7A5C" stroke-width="2.5"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 42V14" />                          <!-- main stem -->
  <path d="M24 30c0-6.5 5-11 12-11-1 6.5-5.5 11-12 11Z" />  <!-- right leaf -->
  <path d="M24 22c0-5.5-4-9.5-10-9.5C15 18 18.8 22 24 22Z" /> <!-- left leaf -->
  <path d="M24 14c0-4.5 3-8 8-8-1 4.5-3.5 8-8 8Z" />        <!-- top leaf -->
</svg>
```

Using SVG (rather than a `.ico` or `.png`) means the icon is drawn from vector paths and stays crisp at any size/zoom level. It lives at `public/favicon.svg` and is wired up in `index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

Anything in the `public/` folder is served as-is at the site root, unprocessed by Vite — which is exactly what you want for static assets like favicons.

### Linting

`oxlint` was added as the linter (a tool that scans code for likely mistakes and style issues, without running it). It's a newer, Rust-based linter chosen for speed over the more common ESLint. `.oxlintrc.json` turns on React-specific rules, like enforcing the [Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning) — a React requirement that hooks (functions like `useParams()`) are only called in consistent places, since React relies on call order internally.

---

## Where things stand

- App runs via `npm run dev`, builds via `npm run build`, lints via `npm run lint`.
- Four routes exist as placeholders (`Landing`, `Login`, `Dashboard`, `Lesson`) — each renders only a label right now, no real UI or logic yet.
- `components/` is scaffolded but empty — first reusable pieces (buttons, layout wrappers, nav) will go here as pages need them.
- No state management, no backend/API calls, no auth logic yet — this commit is purely the shell the app will be built inside.
