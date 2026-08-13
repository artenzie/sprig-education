import { useMemo } from "react";
import katex from "katex";

/**
 * react-katex bundles its own (much older, 0.16.x) copy of katex rather than
 * using whatever version the app installs, and that nested copy — once run
 * through Vite's dependency pre-bundling — mis-parses ordinary commands like
 * `\approx` in the browser even though it works fine called directly under
 * Node. Calling the app's own katex.renderToString ourselves sidesteps that
 * bundling issue and keeps the CSS class names (`.katex-base` etc.) in sync
 * with the `katex/dist/katex.min.css` this app imports, which the nested
 * version's older unprefixed classes didn't match either.
 */
function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return tex;
  }
}

export function InlineMath({ math }: { math: string }) {
  const html = useMemo(() => renderKatex(math, false), [math]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function BlockMath({ math }: { math: string }) {
  const html = useMemo(() => renderKatex(math, true), [math]);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
