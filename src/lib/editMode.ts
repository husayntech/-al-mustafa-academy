import { useEffect, useState } from "react";

/**
 * "Edit Mode" — a single switch on the Admin Dashboard that turns the
 * in-place editing tools on the landing page on or off:
 *   - image "Change" buttons (EditableImage)
 *   - Style Inspector (ContentInspector)
 *   - Style Editor (SpacingGuide)
 *
 * The state is stored in localStorage (per browser) so it persists across
 * tabs/refreshes and is shared between the admin dashboard and the site.
 * It can only be switched from the admin dashboard (admin login required).
 */
export const EDIT_MODE_KEY = "almustafa-edit-mode";

export function getEditMode(): boolean {
  try {
    return localStorage.getItem(EDIT_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setEditMode(on: boolean) {
  try {
    localStorage.setItem(EDIT_MODE_KEY, on ? "on" : "off");
    // Notify the same tab (and the storage event covers other tabs).
    window.dispatchEvent(new CustomEvent("edit-mode-changed"));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

/** Reactive hook — true when Edit Mode is currently enabled. */
export function useEditMode(): boolean {
  const [on, setOn] = useState(getEditMode);

  useEffect(() => {
    const sync = () => setOn(getEditMode());
    window.addEventListener("storage", sync);
    window.addEventListener("edit-mode-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("edit-mode-changed", sync);
    };
  }, []);

  return on;
}

// ---------------------------------------------------------------------------
// Active editing tool — Style Editor (SpacingGuide) and Content Inspector are
// mutually exclusive, and while either is open the floating Edit/Change buttons
// hide so they never swallow the clicks those tools need (e.g. locking an
// element in the Style Editor).
// ---------------------------------------------------------------------------

export type EditToolId = "spacing" | "inspector";
const TOOL_EVENT = "almustafa-active-tool";
let currentTool: EditToolId | null = null;

/** Register the tool as active (displaces any other tool). */
export function claimEditTool(tool: EditToolId) {
  currentTool = tool;
  window.dispatchEvent(new CustomEvent(TOOL_EVENT, { detail: tool }));
}

/** Release the tool — only clears the flag if this tool still owns it. */
export function releaseEditTool(tool: EditToolId) {
  if (currentTool === tool) {
    currentTool = null;
    window.dispatchEvent(new CustomEvent(TOOL_EVENT, { detail: null }));
  }
}

/** Reactive hook — the currently active editing tool (null when none). */
export function useActiveEditTool(): EditToolId | null {
  const [tool, setTool] = useState<EditToolId | null>(currentTool);

  useEffect(() => {
    const sync = (e: Event) => setTool((e as CustomEvent).detail as EditToolId | null);
    window.addEventListener(TOOL_EVENT, sync);
    return () => window.removeEventListener(TOOL_EVENT, sync);
  }, []);

  return tool;
}
