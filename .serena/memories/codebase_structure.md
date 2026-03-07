# Codebase Structure

## Frontend (src/)
- `src/main.js` — Main app logic: Tauri integration, theme switching, drag-drop, file loading, TOC, search, settings, keyboard shortcuts, menu handling, zoom, recent files, scroll memory (~500 lines)
- `src/renderer.js` — markdown-it pipeline with all plugins, KaTeX rules, Mermaid post-render, highlight.js integration
- `src/styles/base.css` — All structural/layout styles (~800 lines): markdown-body, TOC sidebar, search bar, settings panel, help panel, titlebar, print stylesheet
- `src/styles/github-light.css` — "Red Graphite" light theme (CSS custom properties only)
- `src/styles/github-dark.css` — "Dark Graphite" dark theme (CSS custom properties only)
- `index.html` — App shell with titlebar, search bar, settings panel, help panel, TOC sidebar, content area, empty state

## Backend (src-tauri/)
- `src-tauri/src/lib.rs` — Rust backend (~180 lines): `open_file`, `get_initial_file`, `print_page` commands, file watching with notify-debouncer-mini, native menu bar, CLI args handling
- `src-tauri/src/main.rs` — Entry point (minimal)
- `src-tauri/tauri.conf.json` — Tauri config: window settings, bundle config, file associations
- `src-tauri/capabilities/default.json` — Permissions for window, events, dialog, opener plugins
- `src-tauri/Cargo.toml` — Rust dependencies

## Other
- `docs/plans/` — Design doc and implementation plan
- `.github/workflows/release.yml` — Multi-platform release CI (GitHub Actions)
- `test/` — Test files directory

## Theme Architecture
Both theme CSS files are always loaded. Theme switching works via `data-theme` attribute on `<html>` and `<body>`:
- Light: `:root[data-theme="light"]` and `:root:not([data-theme])` (fallback)
- Dark: `:root[data-theme="dark"]`
- CSS custom properties define all colors; structural styles are in base.css
