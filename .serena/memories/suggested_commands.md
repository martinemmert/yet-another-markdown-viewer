# Suggested Commands

## Prerequisites
Rust toolchain is at `/Users/martinemmert/.cargo/bin`. Source it before running Rust/Tauri commands:
```bash
source /Users/martinemmert/.cargo/env
```

## Development
```bash
# Start dev server (Vite + Tauri)
npx tauri dev

# Build frontend only
npm run build

# Build production app
npx tauri build

# Preview Vite build
npm run preview
```

## Utilities
```bash
# Kill dev server on port 1420 (if stuck)
lsof -ti:1420 | xargs kill -9

# Install npm dependencies
npm install

# Check Rust compilation
cd src-tauri && cargo check
```

## Git
```bash
git status
git diff
git log --oneline -10
```

## CI/CD
- GitHub Actions release workflow triggers on tag push (`v*`)
- Builds macOS universal, Windows, Linux
- Config at `.github/workflows/release.yml`

## Important Notes
- Do NOT use `cargo tauri` — use `npx tauri` instead (tauri CLI is installed as npm devDependency)
- In `tauri dev`, CWD is `src-tauri/` — CLI path resolution must account for this
- `notify-debouncer-mini` 0.7.x depends on `notify` 8.x — do NOT add direct `notify` 9.x
