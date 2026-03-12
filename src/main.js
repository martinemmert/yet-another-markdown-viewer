import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Store } from "@tauri-apps/plugin-store";
import { getMatches } from "@tauri-apps/plugin-cli";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { attachConsole } from "@tauri-apps/plugin-log";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { arch, platform } from "@tauri-apps/plugin-os";
import { render, postRender } from "./renderer.js";
import "katex/dist/katex.min.css";

// Fonts
import "@fontsource-variable/literata";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource-variable/lora";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/source-sans-3";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/700.css";
import "@fontsource-variable/merriweather";
import "@fontsource-variable/open-sans";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/700.css";

// ── Store ────────────────────────────────────────────────────────

const storePromise = Store.load("settings.json");

// Start log attachment in parallel — don't block on it
attachConsole().catch(() => {});

const store = await storePromise;

// One-time migration from localStorage (non-blocking after first run)
async function migrateFromLocalStorage() {
  if (await store.get("migrated")) return;
  try {
    const settings = localStorage.getItem("yamv-settings");
    if (settings) await store.set("settings", JSON.parse(settings));
    const recent = localStorage.getItem("yamv-recent");
    if (recent) await store.set("recent", JSON.parse(recent));
    const scroll = localStorage.getItem("yamv-scroll");
    if (scroll) await store.set("scroll-positions", JSON.parse(scroll));
    const lastFile = localStorage.getItem("yamv-last-file");
    if (lastFile) await store.set("last-file", lastFile);
    const welcomed = localStorage.getItem("yamv-welcomed");
    if (welcomed) await store.set("welcomed", true);
  } catch { /* ignore migration errors */ }
  await store.set("migrated", true);
  await store.save();
}
migrateFromLocalStorage();

// ── DOM Elements ─────────────────────────────────────────────────

const contentEl = document.getElementById("content");
const scrollEl = document.getElementById("content-scroll");
const emptyStateEl = document.getElementById("empty-state");
const titlebarText = document.getElementById("titlebar-text");
const titlebarStats = document.getElementById("titlebar-stats");
const tocSidebar = document.getElementById("toc-sidebar");
const tocList = document.getElementById("toc-list");
const searchBar = document.getElementById("search-bar");
const searchInput = document.getElementById("search-input");
const searchCount = document.getElementById("search-count");
const appLayout = document.getElementById("app-layout");

let currentDir = "";
let currentMarkdown = "";
let currentFilePath = "";

// ── Utilities ─────────────────────────────────────────────────────

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingTime(words) {
  const mins = Math.ceil(words / 230);
  return mins === 1 ? "1 min read" : `${mins} min read`;
}

// ── Recent files ──────────────────────────────────────────────────

async function getRecentFiles() {
  return (await store.get("recent")) ?? [];
}

async function addRecentFile(path, filename) {
  let recent = (await getRecentFiles()).filter((r) => r.path !== path);
  recent.unshift({ path, filename, time: Date.now() });
  recent = recent.slice(0, 10);
  await store.set("recent", recent);
  store.save();
}

async function renderRecentFiles() {
  const recent = await getRecentFiles();
  const container = document.getElementById("recent-files");
  const list = document.getElementById("recent-list");
  if (recent.length === 0) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  list.innerHTML = "";
  recent.forEach((r) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = r.filename;
    const pathSpan = document.createElement("span");
    pathSpan.className = "recent-path";
    pathSpan.textContent = r.path;
    a.appendChild(pathSpan);
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await openFile(r.path);
      } catch {
        const updated = (await getRecentFiles()).filter((f) => f.path !== r.path);
        await store.set("recent", updated);
        store.save();
        renderRecentFiles();
      }
    });
    const removeBtn = document.createElement("button");
    removeBtn.className = "recent-remove";
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove from list";
    removeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const updated = (await getRecentFiles()).filter((f) => f.path !== r.path);
      await store.set("recent", updated);
      store.save();
      renderRecentFiles();
    });
    li.appendChild(a);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

// ── Scroll position memory ────────────────────────────────────────

async function saveScrollPosition() {
  if (!currentFilePath) return;
  const positions = (await store.get("scroll-positions")) ?? {};
  positions[currentFilePath] = scrollEl.scrollTop;
  await store.set("scroll-positions", positions);
  store.save();
}

async function restoreScrollPosition(path) {
  const positions = (await store.get("scroll-positions")) ?? {};
  if (positions[path]) {
    requestAnimationFrame(() => {
      scrollEl.scrollTop = positions[path];
    });
  }
}

let scrollSaveTimer = null;
scrollEl.addEventListener("scroll", () => {
  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(saveScrollPosition, 500);
  updateActiveTocItem();
});

// ── Image resolution ──────────────────────────────────────────────

function resolveImages() {
  if (!currentDir) return;
  const images = contentEl.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (
      src &&
      !src.startsWith("http") &&
      !src.startsWith("data:") &&
      !src.startsWith("asset:")
    ) {
      const absolutePath = currentDir + "/" + src;
      img.src = convertFileSrc(absolutePath);
    }
  });
}

// ── Content display ───────────────────────────────────────────────

async function showContent(content, dir, filename, filePath) {
  await saveScrollPosition();
  currentDir = dir;
  currentMarkdown = content;
  currentFilePath = filePath || dir + "/" + filename;
  titlebarText.textContent = filename;
  emptyStateEl.style.display = "none";
  appLayout.style.display = "flex";
  contentEl.style.display = "block";

  // Stats
  const words = wordCount(content);
  titlebarStats.textContent = `${words.toLocaleString()} words · ${readingTime(words)}`;

  // Safe: content is from local files on the user's own filesystem.
  // HTML passthrough is a deliberate feature of this local viewer.
  contentEl.innerHTML = render(content);
  resolveImages();
  buildToc();
  await restoreScrollPosition(currentFilePath);

  // Heavy post-processing (Mermaid) deferred to after paint
  requestAnimationFrame(() => postRender(contentEl));

  // Track recent files and last opened (non-blocking)
  addRecentFile(currentFilePath, filename);
  store.set("last-file", currentFilePath);
  store.save();
}

async function showEmptyState() {
  appLayout.style.display = "none";
  emptyStateEl.style.display = "flex";
  titlebarText.textContent = "YAMV";
  titlebarStats.textContent = "";
  await renderRecentFiles();
}

async function openFile(path) {
  const result = await invoke("open_file", { path });
  await showContent(result.content, result.dir, result.filename, path);
}

async function closeFile() {
  if (!currentFilePath && !currentMarkdown) return;
  await saveScrollPosition();
  currentFilePath = "";
  currentMarkdown = "";
  currentDir = "";
  await store.delete("last-file");
  store.save();
  await showEmptyState();
}

async function openFileDialog() {
  const path = await openDialog({
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx", "mdown", "mkd"] }],
    multiple: false,
  });
  if (path) {
    await openFile(path);
  }
}

async function editInEditor() {
  if (!currentFilePath) return;
  const s = await loadSettings();
  if (!s.editor) {
    toggleSettings();
    settingEditor.focus();
    return;
  }
  try {
    await invoke("open_in_editor", { path: currentFilePath, editor: s.editor });
  } catch (e) {
    console.error("Failed to open editor:", e);
  }
}

// ── Theme handling ────────────────────────────────────────────────

function applyTheme(pref) {
  let dark;
  if (pref === "light") dark = false;
  else if (pref === "dark") dark = true;
  else dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const theme = dark ? "dark" : "light";
  const prev = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);

  // Re-render Mermaid diagrams when theme changes
  if (prev && prev !== theme && currentMarkdown) {
    contentEl.innerHTML = render(currentMarkdown);
    resolveImages();
    postRender(contentEl);
    buildToc();
  }
}

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", async () => {
    const s = await loadSettings();
    if (!s.theme || s.theme === "auto") applyTheme("auto");
  });

// ── Event listeners ───────────────────────────────────────────────

listen("file-changed", (event) => {
  const { content, dir, filename } = event.payload;
  showContent(content, dir, filename);
});

// Menu bar actions from Rust
listen("menu-action", (event) => {
  const action = event.payload;
  const actions = {
    "open": () => openFileDialog(),
    "edit-in-editor": () => editInEditor(),
    "close-file": () => closeFile(),
    "print": () => invoke("print_page"),
    "find": () => openSearch(),
    "toggle-toc": () => toggleToc(),
    "settings": () => toggleSettings(),
    "zoom-in": () => { settings.fontSize = Math.min(28, settings.fontSize + 1); saveSettings(settings); applySettings(settings); },
    "zoom-out": () => { settings.fontSize = Math.max(12, settings.fontSize - 1); saveSettings(settings); applySettings(settings); },
    "zoom-reset": () => { settings.fontSize = defaults.fontSize; saveSettings(settings); applySettings(settings); },
    "check-update": () => checkForUpdates(false),
    "show-welcome": () => showWelcome(),
    "show-test-doc": () => showBundledDoc("/test-perf.md", "Rendering Test"),
    "show-help": () => { const h = document.getElementById("help-panel"); h.hidden = !h.hidden; },
  };
  if (actions[action]) actions[action]();
});

listen("tauri://drag-drop", async (event) => {
  const paths = event.payload.paths;
  if (paths && paths.length > 0) {
    const mdExtensions = [".md", ".markdown", ".mdx", ".mdown", ".mkd"];
    const mdFile = paths.find((p) =>
      mdExtensions.some((ext) => p.toLowerCase().endsWith(ext)),
    );
    if (mdFile) {
      try { await openFile(mdFile); } catch (e) { console.error("Failed to open dropped file:", e); }
    }
  }
});

// ── Deep links ───────────────────────────────────────────────────

try {
  onOpenUrl((urls) => {
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        const filePath = parsed.searchParams.get("path") || decodeURIComponent(parsed.pathname);
        if (filePath) openFile(filePath).catch((e) => console.error("Failed to open deep link:", e));
      } catch { /* ignore malformed URLs */ }
    }
  });
} catch { /* deep-link may not be available in dev */ }

// ── External links ────────────────────────────────────────────────

contentEl.addEventListener("click", (e) => {
  const anchor = e.target.closest("a");
  if (!anchor) return;

  const href = anchor.getAttribute("href");
  if (!href) return;

  // Internal anchor links
  if (href.startsWith("#")) {
    e.preventDefault();
    const id = decodeURIComponent(href.slice(1));
    const target = document.getElementById(id);
    if (target) {
      scrollEl.scrollTo({ top: target.offsetTop - 40, behavior: "smooth" });
    }
    return;
  }

  // External links — open in default browser
  if (href.startsWith("http://") || href.startsWith("https://")) {
    e.preventDefault();
    openUrl(href);
  }
});

// ── TOC Sidebar ───────────────────────────────────────────────────

let tocVisible = false;

function toggleToc() {
  tocVisible = !tocVisible;
  tocSidebar.hidden = !tocVisible;
}

function buildToc() {
  tocList.innerHTML = "";
  const headings = contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (headings.length === 0) {
    tocSidebar.hidden = true;
    tocVisible = false;
    return;
  }

  headings.forEach((h) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    const level = h.tagName.toLowerCase();
    a.textContent = h.textContent.replace(/^#\s*/, "");
    a.className = `toc-${level}`;
    a.href = `#${h.id}`;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      scrollEl.scrollTo({ top: h.offsetTop - 40, behavior: "smooth" });
    });
    li.appendChild(a);
    tocList.appendChild(li);
  });

  updateActiveTocItem();
}

function updateActiveTocItem() {
  const headings = contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const links = tocList.querySelectorAll("a");
  if (headings.length === 0) return;

  const scrollTop = scrollEl.scrollTop + 60;
  let activeIndex = 0;
  headings.forEach((h, i) => {
    if (h.offsetTop <= scrollTop) activeIndex = i;
  });

  links.forEach((a, i) => {
    a.classList.toggle("active", i === activeIndex);
  });
}

// ── Search ────────────────────────────────────────────────────────

let searchMatches = [];
let searchCurrentIndex = -1;

function openSearch() {
  searchBar.hidden = false;
  searchInput.focus();
  searchInput.select();
}

function closeSearch() {
  searchBar.hidden = true;
  clearHighlights();
  searchMatches = [];
  searchCurrentIndex = -1;
  searchCount.textContent = "";
}

function clearHighlights() {
  const marks = contentEl.querySelectorAll(".search-highlight");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

function performSearch(query) {
  clearHighlights();
  searchMatches = [];
  searchCurrentIndex = -1;

  if (!query) {
    searchCount.textContent = "";
    return;
  }

  const walker = document.createTreeWalker(
    contentEl,
    NodeFilter.SHOW_TEXT,
    null,
  );

  const textNodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("script, style, .search-bar")) continue;
    textNodes.push(node);
  }

  const lowerQuery = query.toLowerCase();

  textNodes.forEach((node) => {
    const text = node.textContent;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(lowerQuery);
    if (idx === -1) return;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    while (idx !== -1) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.textContent = text.slice(idx, idx + query.length);
      frag.appendChild(mark);
      searchMatches.push(mark);
      lastIdx = idx + query.length;
      idx = lower.indexOf(lowerQuery, lastIdx);
    }
    frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    node.parentNode.replaceChild(frag, node);
  });

  if (searchMatches.length > 0) {
    searchCurrentIndex = 0;
    highlightCurrent();
  }
  updateSearchCount();
}

function highlightCurrent() {
  searchMatches.forEach((m) => m.classList.remove("current"));
  if (searchCurrentIndex >= 0 && searchCurrentIndex < searchMatches.length) {
    const current = searchMatches[searchCurrentIndex];
    current.classList.add("current");
    current.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function updateSearchCount() {
  if (searchMatches.length === 0) {
    searchCount.textContent = searchInput.value ? "0/0" : "";
  } else {
    searchCount.textContent = `${searchCurrentIndex + 1}/${searchMatches.length}`;
  }
}

function searchNext() {
  if (searchMatches.length === 0) return;
  searchCurrentIndex = (searchCurrentIndex + 1) % searchMatches.length;
  highlightCurrent();
  updateSearchCount();
}

function searchPrev() {
  if (searchMatches.length === 0) return;
  searchCurrentIndex =
    (searchCurrentIndex - 1 + searchMatches.length) % searchMatches.length;
  highlightCurrent();
  updateSearchCount();
}

let searchDebounce = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => performSearch(searchInput.value), 150);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.shiftKey ? searchPrev() : searchNext();
    e.preventDefault();
  }
  if (e.key === "Escape") {
    closeSearch();
    e.preventDefault();
  }
});

document.getElementById("search-next").addEventListener("click", searchNext);
document.getElementById("search-prev").addEventListener("click", searchPrev);
document.getElementById("search-close").addEventListener("click", closeSearch);

// ── Copy as Markdown ──────────────────────────────────────────────

document.addEventListener("copy", (e) => {
  if (!currentMarkdown) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const selectedText = selection.toString();
  if (!selectedText.trim()) return;

  const idx = currentMarkdown.indexOf(selectedText.trim());
  if (idx !== -1) {
    const before = currentMarkdown.lastIndexOf("\n", idx);
    const after = currentMarkdown.indexOf("\n", idx + selectedText.trim().length);
    const start = before === -1 ? 0 : before + 1;
    const end = after === -1 ? currentMarkdown.length : after;
    e.clipboardData.setData("text/plain", currentMarkdown.slice(start, end));
    e.preventDefault();
  }
});

// ── Settings ──────────────────────────────────────────────────────

const settingsPanel = document.getElementById("settings-panel");
const settingsBackdrop = document.getElementById("settings-backdrop");
const settingFont = document.getElementById("setting-font");
const settingEditor = document.getElementById("setting-editor");
const sizeValue = document.getElementById("size-value");
const lhValue = document.getElementById("lh-value");

const FONT_THEMES = {
  "literata-inter": {
    body: '"Literata Variable", "Literata", Georgia, serif',
    heading: '"Inter Variable", "Inter", -apple-system, Helvetica, Arial, sans-serif',
    code: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
  "lora-plex": {
    body: '"Lora Variable", "Lora", Georgia, serif',
    heading: '"IBM Plex Sans", -apple-system, Helvetica, Arial, sans-serif',
    code: '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace',
  },
  "source": {
    body: '"Source Serif 4 Variable", "Source Serif 4", Georgia, serif',
    heading: '"Source Sans 3 Variable", "Source Sans 3", -apple-system, Helvetica, Arial, sans-serif',
    code: '"Source Code Pro", ui-monospace, SFMono-Regular, monospace',
  },
  "merriweather-open": {
    body: '"Merriweather Variable", "Merriweather", Georgia, serif',
    heading: '"Open Sans Variable", "Open Sans", -apple-system, Helvetica, Arial, sans-serif',
    code: '"Fira Code", ui-monospace, SFMono-Regular, monospace',
  },
  "system-serif": {
    body: '"New York", "Iowan Old Style", "Apple Garamond", Baskerville, "Times New Roman", serif, "Apple Color Emoji", "Segoe UI Emoji"',
    heading: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    code: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  "system-sans": {
    body: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    heading: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    code: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  "system-mono": {
    body: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    heading: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    code: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
};

const defaults = { font: "literata-inter", fontSize: 17, lineHeight: 1.7, maxWidth: 820, theme: "auto", editor: "" };

async function loadSettings() {
  const saved = await store.get("settings");
  return { ...defaults, ...(saved || {}) };
}

async function saveSettings(s) {
  await store.set("settings", s);
  store.save();
}

function applySettings(s) {
  const fontTheme = FONT_THEMES[s.font] || FONT_THEMES["literata-inter"];
  document.body.style.fontFamily = fontTheme.body;
  document.body.style.fontSize = s.fontSize + "px";
  document.body.style.lineHeight = s.lineHeight;
  contentEl.style.maxWidth = s.maxWidth + "px";

  document.documentElement.style.setProperty("--heading-font", fontTheme.heading);
  document.documentElement.style.setProperty("--code-font", fontTheme.code);

  settingFont.value = s.font;
  settingEditor.value = s.editor || "";
  sizeValue.innerHTML = s.fontSize + "<small>px</small>";
  lhValue.textContent = s.lineHeight.toFixed(1);

  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeVal === (s.theme || "auto"));
  });

  document.querySelectorAll(".width-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.width) === s.maxWidth);
  });

  applyTheme(s.theme || "auto");
}

// Load settings and version info in parallel
const [settingsData, appVersion] = await Promise.all([
  loadSettings(),
  getVersion(),
]);
let settings = settingsData;
applySettings(settings);

// Version display (arch/platform are sync)
const appArch = arch();
const appPlatform = platform();
const isDev = window.location.hostname === "localhost";
document.getElementById("settings-version").textContent = `YAMV v${appVersion} (${appPlatform}-${appArch}${isDev ? ", dev" : ""})`;

// Default app
const defaultAppStatus = document.getElementById("default-app-status");
const defaultAppBtn = document.getElementById("default-app-btn");

async function updateDefaultAppStatus() {
  try {
    const isDefault = await invoke("is_default_markdown_app");
    if (isDefault) {
      defaultAppStatus.textContent = "YAMV is the default";
      defaultAppStatus.className = "cli-status installed";
      defaultAppBtn.textContent = "Set Default";
      defaultAppBtn.disabled = true;
    } else {
      defaultAppStatus.textContent = "Not set as default";
      defaultAppStatus.className = "cli-status";
      defaultAppBtn.textContent = "Set Default";
      defaultAppBtn.disabled = false;
    }
  } catch {
    defaultAppStatus.textContent = "Unable to check";
    defaultAppBtn.disabled = true;
  }
}

defaultAppBtn.addEventListener("click", async () => {
  defaultAppBtn.disabled = true;
  defaultAppBtn.textContent = "Setting…";
  try {
    await invoke("set_default_markdown_app");
  } catch (e) {
    console.error("Failed to set default app:", e);
  }
  await updateDefaultAppStatus();
});

// CLI install
const cliStatus = document.getElementById("cli-status");
const cliBtn = document.getElementById("cli-install-btn");

async function updateCliStatus() {
  try {
    const installed = await invoke("check_cli_installed");
    if (installed) {
      cliStatus.textContent = "Installed at /usr/local/bin/yamv";
      cliStatus.className = "cli-status installed";
      cliBtn.textContent = "Uninstall";
      cliBtn.className = "cli-btn uninstall";
      cliBtn.disabled = false;
    } else {
      cliStatus.textContent = "Not installed";
      cliStatus.className = "cli-status";
      cliBtn.textContent = "Install";
      cliBtn.className = "cli-btn";
      cliBtn.disabled = false;
    }
  } catch {
    cliStatus.textContent = "Unable to check";
    cliBtn.disabled = true;
  }
}

cliBtn.addEventListener("click", async () => {
  const isInstalled = cliBtn.textContent === "Uninstall";
  cliBtn.disabled = true;
  cliBtn.textContent = isInstalled ? "Removing…" : "Installing…";
  try {
    if (isInstalled) {
      await invoke("uninstall_cli");
    } else {
      await invoke("install_cli");
    }
  } catch (e) {
    console.error("CLI operation failed:", e);
  }
  await updateCliStatus();
});

function toggleSettings() {
  const show = settingsPanel.hidden;
  settingsPanel.hidden = !show;
  settingsBackdrop.hidden = !show;
  if (show) { updateDefaultAppStatus(); updateCliStatus(); }
}

document.getElementById("settings-close").addEventListener("click", () => {
  settingsPanel.hidden = true;
  settingsBackdrop.hidden = true;
});

settingsBackdrop.addEventListener("click", () => {
  settingsPanel.hidden = true;
  settingsBackdrop.hidden = true;
});

document.querySelectorAll(".theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    settings.theme = btn.dataset.themeVal;
    saveSettings(settings);
    applySettings(settings);
  });
});

settingFont.addEventListener("change", () => {
  settings.font = settingFont.value;
  saveSettings(settings);
  applySettings(settings);
});

settingEditor.addEventListener("change", () => {
  settings.editor = settingEditor.value.trim();
  saveSettings(settings);
});

document.getElementById("size-up").addEventListener("click", () => {
  settings.fontSize = Math.min(28, settings.fontSize + 1);
  saveSettings(settings);
  applySettings(settings);
});

document.getElementById("size-down").addEventListener("click", () => {
  settings.fontSize = Math.max(12, settings.fontSize - 1);
  saveSettings(settings);
  applySettings(settings);
});

document.getElementById("lh-up").addEventListener("click", () => {
  settings.lineHeight = Math.min(2.4, +(settings.lineHeight + 0.1).toFixed(1));
  saveSettings(settings);
  applySettings(settings);
});

document.getElementById("lh-down").addEventListener("click", () => {
  settings.lineHeight = Math.max(1.2, +(settings.lineHeight - 0.1).toFixed(1));
  saveSettings(settings);
  applySettings(settings);
});

document.querySelectorAll(".width-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    settings.maxWidth = parseInt(btn.dataset.width);
    saveSettings(settings);
    applySettings(settings);
  });
});

// ── Keyboard shortcuts ────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  const cmd = e.metaKey || e.ctrlKey;

  // Cmd+O — open file
  if (cmd && e.key === "o") {
    e.preventDefault();
    openFileDialog();
  }
  // Cmd+W — close file
  if (cmd && e.key === "w") {
    e.preventDefault();
    closeFile();
    return;
  }
  // Cmd+F — search
  if (cmd && e.key === "f") {
    e.preventDefault();
    openSearch();
  }
  // Cmd+Shift+T or Cmd+\ — toggle TOC
  if (cmd && (e.key === "\\" || (e.shiftKey && e.key === "t"))) {
    e.preventDefault();
    toggleToc();
  }
  // Cmd+, — toggle settings
  if (cmd && e.key === ",") {
    e.preventDefault();
    toggleSettings();
  }
  // Cmd+? — toggle help
  if (cmd && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
    e.preventDefault();
    const help = document.getElementById("help-panel");
    help.hidden = !help.hidden;
  }
  // Cmd+P — print
  if (cmd && e.key === "p") {
    e.preventDefault();
    invoke("print_page");
  }
  // Cmd+= / Cmd+- — zoom (font size)
  if (cmd && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    settings.fontSize = Math.min(28, settings.fontSize + 1);
    saveSettings(settings);
    applySettings(settings);
  }
  if (cmd && e.key === "-") {
    e.preventDefault();
    settings.fontSize = Math.max(12, settings.fontSize - 1);
    saveSettings(settings);
    applySettings(settings);
  }
  if (cmd && e.key === "0") {
    e.preventDefault();
    settings.fontSize = defaults.fontSize;
    saveSettings(settings);
    applySettings(settings);
  }
  // Escape — close panels
  if (e.key === "Escape") {
    if (!searchBar.hidden) closeSearch();
    else if (!settingsPanel.hidden) { settingsPanel.hidden = true; settingsBackdrop.hidden = true; }
    else if (!document.getElementById("help-panel").hidden) document.getElementById("help-panel").hidden = true;
  }
});

// ── Updater ───────────────────────────────────────────────────────

const updateBanner = document.getElementById("update-banner");
const updateMessage = document.getElementById("update-message");
const updateAction = document.getElementById("update-action");
const updateDismiss = document.getElementById("update-dismiss");

let pendingUpdate = null;

function showUpdateBanner(version) {
  updateMessage.textContent = `YAMV ${version} is available`;
  updateAction.textContent = "Update";
  updateAction.disabled = false;
  updateBanner.hidden = false;
}

updateAction.addEventListener("click", async () => {
  if (!pendingUpdate) return;
  updateAction.textContent = "Downloading…";
  updateAction.disabled = true;
  try {
    await pendingUpdate.downloadAndInstall();
    updateMessage.textContent = "Update installed — restarting…";
    updateAction.hidden = true;
    updateDismiss.hidden = true;
    setTimeout(() => relaunch(), 1000);
  } catch (e) {
    console.error("Update failed:", e);
    updateMessage.textContent = "Update failed. Try again later.";
    updateAction.textContent = "Retry";
    updateAction.disabled = false;
  }
});

updateDismiss.addEventListener("click", () => {
  updateBanner.hidden = true;
});

async function checkForUpdates(silent = true) {
  try {
    const update = await check();
    if (update) {
      pendingUpdate = update;
      showUpdateBanner(update.version);
      return true;
    } else if (!silent) {
      updateMessage.textContent = "You're on the latest version";
      updateAction.hidden = true;
      updateBanner.hidden = false;
      setTimeout(() => { updateBanner.hidden = true; updateAction.hidden = false; }, 3000);
    }
  } catch (e) {
    console.error("Update check failed:", e);
    if (!silent) {
      updateMessage.textContent = "Could not check for updates";
      updateAction.hidden = true;
      updateBanner.hidden = false;
      setTimeout(() => { updateBanner.hidden = true; updateAction.hidden = false; }, 3000);
    }
  }
  return false;
}

// ── Print styles ──────────────────────────────────────────────────
// (defined in base.css @media print)

// ── Welcome ───────────────────────────────────────────────────────

const WELCOME_MD = `![YAMV](/icon.png)

# Welcome to YAMV 👋

Thanks for trying out **YAMV** — the **Yet Another Markdown Viewer**.

YAMV does one thing and does it well: it lets you ==read markdown files==, beautifully rendered, right on your desktop. No editing, no distractions — just your words, nicely formatted.

If you write markdown in VS Code, Vim, Obsidian, or any text editor, YAMV is your reading companion. Keep it open next to your editor and it will ==automatically update== whenever you save — no manual refreshing needed.

Think of it as a dedicated reading pane for all your \`.md\` files: READMEs, notes, documentation, journals, or anything else you write in markdown.

---

## How to open a file

There are a few ways to get started:

- **Drag & drop** a \`.md\` file onto this window
- Use **File → Open** from the menu bar (or press \`⌘O\`)
- From the terminal: \`yamv path/to/file.md\`
- Set YAMV as your default app for \`.md\` files and just double-click

## Navigate with the outline

Press \`⌘\\\` or use **View → Table of Contents** to open the outline sidebar. It lists all headings in the document and highlights where you are as you scroll — try it now on this page!

## What YAMV can render

YAMV supports the full range of markdown you'd expect — and then some. Here are a few examples:

### Code with syntax highlighting

\`\`\`javascript
function greet(name) {
  return \\\`Hello, \\\${name}! Welcome to YAMV.\\\`;
}
\`\`\`

### Math with KaTeX

Inline math like $E = mc^2$ works, and so do block equations:

$$\\\\sum_{i=1}^{n} i = \\\\frac{n(n+1)}{2}$$

### Mermaid diagrams

\`\`\`mermaid
graph LR
  A[Write Markdown] --> B[Save File]
  B --> C[YAMV Auto-Reloads]
  C --> D[Read Beautifully]
\`\`\`

### Tables, tasks, and more

| Feature | Supported |
|---|:---:|
| GitHub-flavored markdown | :white_check_mark: |
| ==Highlighted text== | :white_check_mark: |
| Footnotes[^1] | :white_check_mark: |
| Emoji :wave: | :white_check_mark: |
| Task lists | :white_check_mark: |

- [x] Render markdown beautifully
- [x] Live-reload on file changes
- [ ] Open your first file!

[^1]: Like this one — hover or scroll down to see it.

## QuickLook preview (macOS)

Press **Space** on any \`.md\` file in Finder to see a fully rendered preview — complete with syntax highlighting, KaTeX math, and Mermaid diagrams. Works in both light and dark mode, no extra setup needed.

## Set as default viewer (macOS)

Open **Settings** (\`⌘,\`) and click **Set Default** under *Default App* to register YAMV for:

- **Quick Look** previews (Space bar in Finder)
- **Double-click** to open \`.md\` files directly in YAMV
- **"Open with"** context menu in Finder

## Edit in your favorite editor

YAMV is a viewer — but when you need to edit, press \`⌘E\` to open the current file in your preferred editor. Set your editor in **Settings** (\`⌘,\`) under *Editor* (e.g. "Visual Studio Code", "Cursor", "Sublime Text").

## Make it yours

Open **Settings** with \`⌘,\` to customize:

- **Theme** — light, dark, or follow your system
- **Typography** — choose from several carefully paired font combinations
- **Text size & line height** — adjust to your reading preference
- **Content width** — narrow, medium, or wide
- **Editor** — choose your preferred app for editing markdown files
- **Default App** — register YAMV as your default markdown viewer
- **Command Line** — install the \`yamv\` CLI command

## Handy shortcuts

| Shortcut | Action |
|---|---|
| \`⌘O\` | Open file |
| \`⌘E\` | Edit in editor |
| \`⌘W\` | Close file |
| \`⌘F\` | Search in document |
| \`⌘,\` | Open settings |
| \`⌘\\\` | Toggle table of contents sidebar |
| \`⌘+\` / \`⌘-\` | Zoom in / out |
| \`⌘0\` | Reset zoom |
| \`⌘P\` | Print |

---

> That's it! Drop a markdown file onto this window to start reading. This welcome page won't show up again — you'll see your recent files here instead.
`;

async function showWelcome() {
  currentMarkdown = WELCOME_MD;
  currentFilePath = "";
  currentDir = "";
  titlebarText.textContent = "Welcome";
  emptyStateEl.style.display = "none";
  appLayout.style.display = "flex";
  contentEl.style.display = "block";
  titlebarStats.textContent = "";
  contentEl.innerHTML = render(WELCOME_MD);
  postRender(contentEl);
  buildToc();
  await store.set("welcomed", true);
  store.save();
}

async function showBundledDoc(path, title) {
  try {
    const res = await fetch(path);
    const md = await res.text();
    currentMarkdown = md;
    currentFilePath = "";
    currentDir = "";
    titlebarText.textContent = title;
    emptyStateEl.style.display = "none";
    appLayout.style.display = "flex";
    contentEl.style.display = "block";
    titlebarStats.textContent = "";
    contentEl.innerHTML = render(md);
    resolveImages();
    buildToc();
    requestAnimationFrame(() => postRender(contentEl));
  } catch (e) {
    console.error("Failed to load bundled doc:", e);
  }
}

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  // Check CLI args via the cli plugin
  let initialFile = null;
  try {
    const matches = await getMatches();
    const fileArg = matches.args?.file?.value;
    if (fileArg) initialFile = fileArg;
  } catch {
    // CLI plugin may not be available
  }

  if (initialFile) {
    await openFile(initialFile);
  } else {
    // Try reopening last file
    const lastFile = await store.get("last-file");
    if (lastFile) {
      try {
        await openFile(lastFile);
        return;
      } catch {
        await store.delete("last-file");
        store.save();
      }
    }
    // Show welcome on first boot, empty state otherwise
    if (!(await store.get("welcomed"))) {
      await showWelcome();
    } else {
      await showEmptyState();
    }
  }

  // Check for updates after a short delay to not block startup
  setTimeout(() => checkForUpdates(true), 5000);
}

init();
