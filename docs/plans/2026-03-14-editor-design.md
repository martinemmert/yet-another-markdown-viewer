# YAMV Built-in Markdown Editor

## Design Decision

Bear-style inline editing using CodeMirror 6. No split panes. The editor IS the viewer — markdown syntax is visible but styled. Headings stay large, bold stays bold, code stays highlighted. Cursor on a line reveals raw markdown; move away and markers fade/hide.

## Architecture

- `src/editor.js` — CodeMirror 6 setup, Bear-like decoration plugin, theme
- `src/styles/editor.css` — Editor-specific styles
- Toggle between view and edit mode with `Cmd+E`
- External editor moved to `Cmd+Shift+E`
- Auto-save with 1s debounce via `write_file` Tauri command
- File watcher events ignored while editing

## Bear-like Decorations (ViewPlugin)

When cursor is NOT on a line:
- `# Heading` → large text, `#` hidden
- `**bold**` → bold text, `**` hidden
- `*italic*` → italic text, `*` hidden
- `` `code` `` → monospace + background, backticks hidden
- `[text](url)` → accent color text, URL hidden
- `> quote` → left border, `>` hidden
- `---` → visual divider widget
- `- [ ] task` → interactive checkbox widget

When cursor IS on a line:
- Full markdown syntax visible, still styled (markers dimmed)

## Integration

- Reuses app typography settings (font, size, line height, width)
- Theme-aware (light/dark)
- TOC sidebar works in edit mode (rebuilt on content change)
- Stats (word count, reading time) update live
