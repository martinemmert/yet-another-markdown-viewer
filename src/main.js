import { render, postRender } from "./renderer.js";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";

const contentEl = document.getElementById("content");
const emptyStateEl = document.getElementById("empty-state");

function showContent(markdown) {
  emptyStateEl.style.display = "none";
  contentEl.style.display = "block";
  // Safe: content is from local files on the user's own filesystem.
  // HTML passthrough is a deliberate feature of this local viewer.
  contentEl.innerHTML = render(markdown);
  postRender(contentEl);
}

function showEmptyState() {
  contentEl.style.display = "none";
  emptyStateEl.style.display = "flex";
}

// Theme handling
function applyTheme() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("theme-light").disabled = dark;
  document.getElementById("theme-dark").disabled = !dark;
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

applyTheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

// Initialize — will be wired to Tauri in later tasks
showEmptyState();

// Export for Tauri integration
window.__yamv = { showContent, showEmptyState };
