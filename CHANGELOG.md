# Changelog

All notable changes to YAMV are documented in this file.

## [Unreleased]

### Fixed
- CLI command (`yamv file.md`) no longer blocks the terminal — now uses a wrapper script with `open -a` instead of a direct symlink

## [0.7.0] — 2026-03-10

### Added
- CLI install/uninstall button in Settings — creates symlink at `/usr/local/bin/yamv` with admin prompt
- "Rendering Test Document" in Help menu — bundled stress-test with code, math, tables, and diagrams
- Stale recent files are automatically removed when clicked

### Changed
- Faster startup: parallelized store/settings/version loading, deferred non-critical init
- Smoother scrolling: GPU layer promotion and CSS containment on scroll container
- Mermaid diagrams render after initial paint via `requestAnimationFrame`
- Store writes and log attachment no longer block the main thread

### Fixed
- Blank window when last-opened file no longer exists — now falls through to welcome/empty state
- Bundled documents (Welcome, Test) can now be closed with `⌘W`

## [0.6.0] — 2026-03-09

### Changed
- App identifier changed from `com.yamv.viewer` to `de.martinemmert.projects.yamv`
  - **Note:** App data directory moves to `~/Library/Application Support/de.martinemmert.projects.yamv/`. Existing settings will not carry over automatically.

## [0.5.0] — 2026-03-09

### Added
- Auto-updater with signed releases — checks on startup, update banner with download/install/relaunch
- "Check for Updates…" menu item under YAMV menu
- "Welcome Guide" menu item under Help to re-show the welcome page
- Welcome page on first launch with feature overview and interactive demos
- Version and architecture display in settings panel
- Delete button on recent files list entries
- `yamv` deep-link URL scheme support
- CLI file opening via `yamv file.md` (using tauri-plugin-cli)

### Changed
- Settings persistence moved from localStorage to Tauri Store plugin (with one-time migration)
- Logging via tauri-plugin-log (stdout, log file, webview console)
- Titlebar drag zone enlarged (52px) with subtle hover effect
- Welcome page icon made transparent for dark mode compatibility

### Infrastructure
- Signed release builds with tauri-plugin-updater
- Added plugins: store, cli, updater, deep-link, log, process, os
- GitHub Actions release workflow includes signing environment variables
- README with installation instructions for non-technical macOS users

## [0.4.0] — 2026-03-08

### Added
- Custom app icon
- Project README with feature list and installation instructions

### Fixed
- Scrollbar positioning moved to window edge
- Mermaid theme switching on light/dark toggle
- Layout polish and spacing improvements

## [0.3.0] — 2026-03-08

### Added
- Bear-inspired themes: "Red Graphite" (light) and "Dark Graphite" (dark), replacing the Nord palette
- Custom Mermaid diagram themes matching the light/dark color schemes
- Settings modal redesign: centered overlay with backdrop, segmented controls for theme and line width, stepper controls for text size and line height
- Settings close button and click-outside-to-dismiss
- `==highlighted text==` support via markdown-it-mark plugin with theme-aware styling
- Comprehensive test document showcasing all supported features

### Changed
- Theme switching now uses CSS `[data-theme]` attribute selectors instead of toggling stylesheet `disabled` state — fixes dark theme not applying in production builds
- Mermaid diagrams re-render when switching between light and dark themes
- Reduced backdrop blur on settings modal for better live-preview of theme changes
- Removed bottom borders from h1 and h2 headings for cleaner appearance
- Scrollbar moved to the window edge with separate scroll container and content wrapper
- Content area has right padding for comfortable scrollbar spacing

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
