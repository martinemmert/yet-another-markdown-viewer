import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { render, postRender } from "./renderer.js";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";

const contentEl = document.getElementById("content");
const emptyStateEl = document.getElementById("empty-state");

let currentDir = "";

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

function showContent(content, dir, filename) {
  currentDir = dir;
  emptyStateEl.style.display = "none";
  contentEl.style.display = "block";
  // Safe: content is from local files on the user's own filesystem.
  // HTML passthrough is a deliberate feature of this local viewer.
  contentEl.innerHTML = render(content);
  resolveImages();
  postRender(contentEl);
}

function showEmptyState() {
  contentEl.style.display = "none";
  emptyStateEl.style.display = "flex";
}

async function openFile(path) {
  try {
    const result = await invoke("open_file", { path });
    showContent(result.content, result.dir, result.filename);
  } catch (e) {
    console.error("Failed to open file:", e);
  }
}

// Theme handling
function applyTheme() {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("theme-light").disabled = dark;
  document.getElementById("theme-dark").disabled = !dark;
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

applyTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applyTheme);

// Listen for file changes from Rust backend
listen("file-changed", (event) => {
  const { content, dir, filename } = event.payload;
  showContent(content, dir, filename);
});

// Drag and drop
listen("tauri://drag-drop", async (event) => {
  const paths = event.payload.paths;
  if (paths && paths.length > 0) {
    const mdExtensions = [".md", ".markdown", ".mdx", ".mdown", ".mkd"];
    const mdFile = paths.find((p) =>
      mdExtensions.some((ext) => p.toLowerCase().endsWith(ext)),
    );
    if (mdFile) {
      await openFile(mdFile);
    }
  }
});

// Check for initial file from CLI args via Tauri command
async function init() {
  const initialFile = await invoke("get_initial_file");
  if (initialFile) {
    await openFile(initialFile);
  } else {
    showEmptyState();
  }
}

init();
