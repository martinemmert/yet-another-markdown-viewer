# Code Style and Conventions

## JavaScript
- ES modules (`"type": "module"` in package.json)
- No framework — vanilla JS with Tauri APIs
- `const` preferred, `let` when mutation needed
- Template literals for string building
- Dynamic imports for heavy libraries (Mermaid)
- localStorage for persisting user preferences
- Event-driven: Tauri `listen()` for backend events, DOM event listeners for UI

## CSS
- CSS custom properties for all theme colors (defined in theme files)
- Structural/layout styles in `base.css`, color-only variables in theme files
- BEM-ish class naming (`.settings-panel`, `.search-bar`, `.toc-sidebar`)
- `var(--custom-prop)` with fallbacks where appropriate
- `@media print` section in base.css for print stylesheet

## Rust
- Tauri v2 command pattern: `#[tauri::command]` functions
- `tauri::Builder` setup with plugins and menu
- File watching via `notify_debouncer_mini` (re-exports `notify` 8.x types)
- Menu events bridge to JS frontend via `app.emit("menu-action", id)`

## Naming
- CSS files: `github-light.css`, `github-dark.css` (historical names, now Bear-themed)
- JS: camelCase for variables/functions
- Rust: snake_case per Rust conventions
- HTML IDs: kebab-case (`#settings-panel`, `#toc-sidebar`)

## Key Patterns
- Theme switching: set `data-theme` attribute on both `<html>` and `<body>`
- Font themes: JS object mapping theme name to CSS font stacks, applied via CSS custom properties
- Mermaid: custom `theme: "base"` with `themeVariables` matching app theme colors
