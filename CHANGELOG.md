# Changelog

All notable changes to YAMV are documented in this file.

## [Unreleased]

### Added
- Bear-inspired themes: "Red Graphite" (light) and "Dark Graphite" (dark), replacing the Nord palette
- Custom Mermaid diagram themes matching the light/dark color schemes
- Settings modal redesign: centered overlay with backdrop, segmented controls for theme and line width, stepper controls for text size and line height
- Settings close button and click-outside-to-dismiss
- `==highlighted text==` support via markdown-it-mark plugin with theme-aware styling
- Comprehensive test document showcasing all supported features
- Serena project configuration for AI-assisted development

### Changed
- Theme switching now uses CSS `[data-theme]` attribute selectors instead of toggling stylesheet `disabled` state — fixes dark theme not applying in production builds
- Reduced backdrop blur on settings modal for better live-preview of theme changes
- Removed bottom borders from h1 and h2 headings for cleaner appearance

## [0.1.0] — 2026-03-07

### Added
- Initial release as a native macOS markdown viewer
- Tauri v2 + vanilla JS + Vite architecture (no framework)
- markdown-it rendering pipeline with plugins:
  - GFM tables, footnotes, emoji, abbreviations, definition lists
  - Task list checkboxes (read-only)
  - Front matter display
  - Anchor links and auto-generated table of contents
- KaTeX math rendering (inline `$...$` and block `$$...$$`)
- Mermaid diagram rendering (lazy-loaded)
- highlight.js syntax highlighting
- File opening via CLI argument, drag-and-drop, or native file dialog (Cmd+O)
- File watching with auto-reload on external changes
- Overlay title bar (chromeless window) with filename and reading stats
- TOC sidebar with active heading tracking (Cmd+\\)
- In-document search with match highlighting and navigation (Cmd+F)
- Copy-as-markdown for selected text
- 7 typography presets with bundled open source fonts:
  - Literata + Inter, Lora + IBM Plex, Source Serif + Source Sans
  - Merriweather + Open Sans, System Serif, System Sans, System Mono
- Settings panel with controls for theme, typography, text size, line height, and line width (Cmd+,)
- Help panel showing all keyboard shortcuts (Cmd+?)
- Native macOS menu bar (YAMV, File, Edit, View, Help) with accelerators
- Native print support via Tauri WebviewWindow (Cmd+P)
- Print stylesheet forcing light colors and showing link URLs
- Zoom controls (Cmd+/-, Cmd+0)
- Recent files list on empty state
- Scroll position memory per file
- Last opened file memory
- Window size/position persistence (tauri-plugin-window-state)
- External links open in default browser
- File associations for .md, .markdown, .mdx, .mdown, .mkd
- GitHub Actions CI for multi-platform releases (macOS universal, Windows, Linux)
