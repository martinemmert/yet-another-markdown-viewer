// WYSIWYG markdown editor using Milkdown Crepe
//
// Rich text editing with markdown as the storage format.
// No visible markdown syntax — headings, bold, lists render as rich text.

import { Crepe, CrepeFeature } from "@milkdown/crepe";

// Crepe theme — frame provides structural + visual styles
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
// Our overrides — imported AFTER frame.css to guarantee cascade wins
import "./styles/editor.css";

// ── Module state ──────────────────────────────────────────────────

let crepe = null;
let saveTimer = null;

// ── Dark mode sync ───────────────────────────────────────────────

function syncDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const el = document.querySelector("#editor-container .milkdown");
  if (el) el.classList.toggle("dark", isDark);
}

// ── Exported API ──────────────────────────────────────────────────

/**
 * Create a Milkdown Crepe editor in the given container element.
 *
 * @param {HTMLElement} container - DOM element to mount the editor in
 * @param {string} content - Initial markdown text
 * @param {object} options
 * @param {function} [options.onSave] - Called with markdown text after debounced save
 * @param {function} [options.onChange] - Called with markdown text on every change
 * @returns {Promise<Crepe>}
 */
export async function createEditor(container, content, options = {}) {
  const { onSave, onChange } = options;

  crepe = new Crepe({
    root: container,
    defaultValue: content,
    features: {
      [CrepeFeature.CodeMirror]: true,
      [CrepeFeature.ListItem]: true,
      [CrepeFeature.LinkTooltip]: true,
      [CrepeFeature.Cursor]: true,
      [CrepeFeature.ImageBlock]: false,
      [CrepeFeature.BlockEdit]: true,
      [CrepeFeature.Toolbar]: true,
      [CrepeFeature.Placeholder]: true,
      [CrepeFeature.Table]: true,
      [CrepeFeature.Latex]: true,
    },
    featureConfigs: {
      [CrepeFeature.Placeholder]: {
        text: "Start writing…",
      },
    },
  });

  // Listen for content changes
  if (onSave || onChange) {
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown === prevMarkdown) return;

        if (onChange) onChange(markdown);

        if (onSave) {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => onSave(markdown), 1000);
        }
      });
    });
  }

  await crepe.create();
  syncDarkMode();

  return crepe;
}

/**
 * Destroy the editor and clean up timers.
 */
export function destroyEditor() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (crepe) {
    crepe.destroy();
    crepe = null;
  }
}

/**
 * Get the current document as markdown text.
 * @returns {string}
 */
export function getContent() {
  if (!crepe) return "";
  return crepe.getMarkdown();
}

/**
 * Sync editor theme with app settings.
 * Crepe uses CSS variables — we override them via the app's theme system.
 */
export function updateTheme() {
  syncDarkMode();
}

/**
 * Focus the editor.
 */
export function focusEditor() {
  if (!crepe) return;
  const el = document.querySelector("#editor-container .ProseMirror");
  if (el) el.focus();
}
