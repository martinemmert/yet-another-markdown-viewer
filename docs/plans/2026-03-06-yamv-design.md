# YAMV — Yet Another Markdown Viewer

## Overview

A fast, native macOS markdown viewer built with Tauri v2 and vanilla JavaScript. No editor. Renders GitHub-flavored markdown with common extensions. Designed to be easy to extend.

## Architecture

Two-layer architecture:

- **Rust backend (Tauri v2)** — file I/O, file watching, system integration, window management
- **Web frontend (vanilla JS)** — markdown parsing, rendering, and styling. No framework.

### Data Flow

1. App receives a file path (CLI arg, Open With, or drag & drop)
2. Rust reads the file, sends content to the frontend via Tauri command/event
3. Frontend parses markdown with markdown-it + plugins, renders to HTML
4. On file change, Rust detects via `notify` crate, re-sends content, frontend re-renders

## Rendering Pipeline

**Engine:** markdown-it with GFM preset

**Plugins:**
- `markdown-it-footnote` — `[^1]` style footnotes
- `markdown-it-emoji` — `:shortcode:` to rendered emoji
- `markdown-it-abbr` — abbreviation definitions
- `markdown-it-deflist` — definition lists
- `markdown-it-anchor` — heading anchors
- `markdown-it-toc-done-right` — auto-generated table of contents
- `markdown-it-front-matter` — YAML front matter display
- KaTeX — `$inline$` and `$$block$$` math rendering
- highlight.js — syntax highlighting in fenced code blocks
- Mermaid — diagram rendering (lazy-loaded, post-render)

**HTML passthrough:** enabled (local viewer, no XSS concern)

**Image handling:** relative paths resolved from the markdown file's directory using Tauri's `convertFileSrc` / asset protocol.

## Theming

- GitHub-styled CSS as the base
- Automatic light/dark mode following macOS system preference
- Detected via `window.matchMedia('(prefers-color-scheme: dark)')`
- Listener for real-time switching
- CSS variables for easy customization

## Rust Backend

### Dependencies
- `tauri` v2 — app framework
- `notify` — file system watcher (debounced ~100ms)
- `clap` — CLI argument parsing

### Commands & Events
- **Command:** `open_file(path: String)` — reads file, starts watcher, returns content + directory path
- **Event (backend to frontend):** `file-changed` — emitted on file modification, carries new content
- **Drag & drop:** handled via Tauri v2 built-in support

### File Watcher
- `notify` in debounced mode (~100ms)
- Watches the single currently-open file
- Swaps watcher when a new file is opened

### App Lifecycle
1. Parse CLI args for optional file path
2. Create single window
3. If file path provided, read and send to frontend immediately
4. Register as handler for markdown file types via `Info.plist`

## Window Configuration

- **Initial default:** 40% monitor width x 80% monitor height, centered
- **Resizable:** yes
- **State persistence:** window size/position remembered via Tauri `window-state` plugin; initial default used only when no saved state exists
- **Title:** shows current filename

## File Opening

- CLI argument: `yamv path/to/file.md`
- Open With / double-click in Finder (file type associations)
- Drag & drop onto window
- Auto-reload on file change

### Registered File Types
`.md`, `.markdown`, `.mdx`, `.mdown`, `.mkd`

## Project Structure

```
yet-another-markdown-viewer/
  src-tauri/
    src/
      main.rs
    tauri.conf.json
    Cargo.toml
  src/
    main.js
    renderer.js
    styles/
      base.css
      github-light.css
      github-dark.css
  index.html
  package.json
  vite.config.js
```

## Extensibility

- Adding a markdown-it plugin: one `md.use(plugin)` call in `renderer.js`
- Custom post-processing: add functions to a post-render hook array
- Theming: override CSS variables or add new stylesheets

## Out of Scope (Phase 1)

- QuickLook extension (planned for phase 2)
- Editing
- Multiple windows/tabs

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| App framework | Tauri v2 |
| Backend language | Rust |
| Frontend | Vanilla JS (Vite build) |
| Markdown engine | markdown-it + plugins |
| Syntax highlighting | highlight.js |
| Math rendering | KaTeX |
| Diagrams | Mermaid |
| Theming | GitHub-styled CSS, system light/dark |
| Package manager | npm |
