# YAMV — Yet Another Markdown Viewer

## Purpose
A native macOS markdown viewer (read-only, no editor) built with Tauri v2. Opens `.md` files via CLI, drag-and-drop, or file dialog and renders them with rich formatting including syntax highlighting, KaTeX math, Mermaid diagrams, and task lists.

## Tech Stack
- **Frontend:** Vanilla JavaScript + Vite (no framework)
- **Backend:** Rust via Tauri v2
- **Rendering:** markdown-it with plugins (GFM, footnotes, emoji, abbreviations, definition lists, anchors, TOC, task lists, front matter)
- **Syntax Highlighting:** highlight.js
- **Math:** KaTeX (inline `$...$` and block `$$...$$`)
- **Diagrams:** Mermaid (lazy-loaded via dynamic import)
- **Fonts:** @fontsource packages (bundled, no network requests)
- **Themes:** Bear-inspired "Red Graphite" (light) and "Dark Graphite" (dark)

## Key Features
- Overlay title bar (chromeless window with `data-tauri-drag-region`)
- TOC sidebar with active heading tracking
- In-document search with highlighting
- Settings panel (theme, typography, text size, line height, line width)
- 7 typography presets using open source fonts
- Native macOS menu bar
- File watching with auto-reload on changes
- Recent files and scroll position memory (localStorage)
- Print support with light-mode print stylesheet
- Zoom controls

## Identifier
`com.yamv.viewer`
