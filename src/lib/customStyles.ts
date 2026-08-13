/**
 * Persisted custom styles for the Style Editor (SpacingGuide).
 *
 * When the user edits margin/padding/style of an element on the landing page
 * and clicks "Save", we store a JSON map of `cssPath -> { prop: value }` in the
 * site content under the key `custom_styles`. On every page load we re-apply
 * those styles to the matching elements, so the edits survive a refresh and
 * apply to the whole site (header, footer, all tabs).
 *
 * The cssPath is a stable, human-readable selector (e.g. `footer h2`) built
 * from the element's id, tag, classes and index, so it survives remounts.
 */

/** Properties the Style Editor can modify — captured & re-applied. */
const EDITABLE_PROPS = [
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRadius",
  "color",
  "backgroundColor",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "width",
  "height",
  "transform",
] as const;

/**
 * Build a stable CSS path for an element, e.g.:
 *   `body > div#root > div > footer > div:nth-of-type(2) > h2`
 *
 * Uses ONLY tag / id / :nth-of-type position — deliberately no class names.
 * Tailwind classes here include arbitrary values (`h-[calc(100vh-4rem)]`,
 * `max-w-[85vw]`, `bg-white/5`…) whose `(`, `)`, `%` chars would make the
 * selector invalid, and state-driven classes change on hover/active, which
 * would make the saved path stale. React renders a deterministic tree, so
 * tag + position alone is a stable, escaping-free selector.
 */
export function getCssPath(el: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = el;

  while (node && node !== document.body && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    if (node.id) part += `#${node.id}`;

    // Add :nth-of-type when there are same-tag siblings
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === node!.tagName
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(node) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(part);
    node = parent;
  }

  return parts.join(" > ");
}

/** Read the currently-edited inline styles of an element (only non-empty). */
export function captureInlineStyles(el: HTMLElement): Record<string, string> {
  const styles: Record<string, string> = {};
  for (const prop of EDITABLE_PROPS) {
    const val = el.style[prop as any];
    if (val && val.trim() !== "") styles[prop] = val;
  }
  return styles;
}

/** Apply a single saved style record to a matching element. */
function applyStyleRecord(selector: string, styles: Record<string, string>) {
  let els: NodeListOf<HTMLElement>;
  try {
    els = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
  } catch {
    return; // invalid selector
  }
  els.forEach((el) => {
    for (const [prop, val] of Object.entries(styles)) {
      (el.style as any)[prop] = val;
    }
  });
}

/**
 * Parse the saved `custom_styles` JSON and apply every rule to the live page.
 * Call after content loads and after React remounts elements.
 */
export function applyCustomStyles(customStylesJson: string | undefined) {
  if (!customStylesJson) return;
  let map: Record<string, Record<string, string>>;
  try {
    map = JSON.parse(customStylesJson);
  } catch {
    return;
  }
  for (const [selector, styles] of Object.entries(map)) {
    if (styles && typeof styles === "object") applyStyleRecord(selector, styles);
  }
}

/**
 * Merge a single element's styles into the saved map and return the new JSON.
 * `path` identifies the element; pass `null` styles to remove it entirely.
 *
 * When merging, previously saved props for the same path are kept (per-prop
 * merge), so re-saving an element never silently drops older saved props.
 */
export function mergeCustomStyles(
  currentJson: string | undefined,
  path: string,
  styles: Record<string, string> | null
): string {
  let map: Record<string, Record<string, string>> = {};
  try {
    map = currentJson ? JSON.parse(currentJson) : {};
  } catch {
    map = {};
  }
  if (styles === null) {
    delete map[path];
  } else if (Object.keys(styles).length > 0) {
    // Per-prop merge: keep previously saved props for the same path
    map[path] = { ...(map[path] || {}), ...styles };
  }
  // empty styles → no-op: leave any existing rule untouched
  return JSON.stringify(map);
}

/** Clear all editable inline styles from an element (used after removing a saved rule). */
export function clearInlineStyles(el: HTMLElement) {
  for (const prop of EDITABLE_PROPS) {
    (el.style as any)[prop] = "";
  }
}
