# Task Completion Checklist

When completing a task in this project:

1. **Test in dev mode:** Run `npx tauri dev` (with `source /Users/martinemmert/.cargo/env` first) and verify changes work
2. **Check both themes:** Verify changes look correct in both Light (Red Graphite) and Dark (Dark Graphite) modes
3. **Check print stylesheet:** If CSS changes were made, verify `@media print` isn't broken
4. **Build test:** Run `npm run build` to ensure Vite builds without errors
5. **No linting/formatting tools configured** — rely on consistent style with existing code

## Common Pitfalls
- Vite bundles all CSS into one file in production — don't rely on enabling/disabling `<link>` tags
- `cargo tauri` won't work — use `npx tauri` instead
- Port 1420 may be occupied from previous dev sessions — kill it first
- Mermaid theme must be re-initialized when app theme changes (it reads `data-theme` at render time)
