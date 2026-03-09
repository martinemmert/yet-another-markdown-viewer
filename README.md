<p align="center">
  <img src="icon.png" alt="YAMV" width="128" height="128">
</p>

<h1 align="center">YAMV</h1>
<p align="center"><strong>Yet Another Markdown Viewer</strong></p>
<p align="center">A fast, native markdown viewer for macOS, Windows, and Linux.</p>

---

## Why YAMV?

Most markdown tools are editors first, viewers second. YAMV is a **dedicated viewer** — open a `.md` file and read it beautifully rendered, with live-reload when the file changes on disk.

Use your favorite text editor to write. Use YAMV to read.

## Features

- **Live reload** — automatically re-renders when the file changes on disk
- **Rich markdown** — GFM tables, task lists, footnotes, emoji, abbreviations, definition lists, `==highlights==`, and math (KaTeX)
- **Mermaid diagrams** — flowcharts, sequence diagrams, and more, rendered inline
- **Syntax highlighting** — powered by highlight.js with theme-aware colors
- **Light & dark themes** — Bear-inspired Red Graphite and Dark Graphite color schemes, with system preference detection
- **Table of contents** — auto-generated sidebar for quick navigation
- **Search** — find text within the rendered document
- **Drag & drop** — drop a markdown file onto the window to open it
- **File associations** — set YAMV as your default `.md` viewer
- **Remembers state** — window size, position, scroll location, and settings persist across sessions

## Installation

Download the latest release for your platform from the [Releases](https://github.com/martinemmert/yet-another-markdown-viewer/releases) page.

### macOS

1. Download the `.dmg` file
2. Drag **YAMV** into your Applications folder
3. On first launch, macOS will show a warning that the app is from an unidentified developer. To open it anyway:
   - **Right-click** (or Control-click) on **YAMV** in your Applications folder and select **Open**
   - In the dialog that appears, click **Open** to confirm
   - You only need to do this once — after that, the app opens normally

   If that doesn't work, go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to the message about YAMV.

   <details>
   <summary>Alternative: using the Terminal</summary>

   Open **Terminal** (found in Applications → Utilities) and paste:
   ```sh
   xattr -cr /Applications/YAMV.app
   ```
   Press Enter, then open the app again.
   </details>

### Windows

Download and run the `.msi` installer.

### Linux

Download the `.deb` or `.AppImage` package.

## Usage

- **Open a file:** `File → Open` or drag a `.md` file onto the window
- **CLI:** `yamv path/to/file.md`
- **Settings:** `Cmd+,` (macOS) / `Ctrl+,` to adjust theme, font, text size, line height, and content width

## Built With

[Tauri v2](https://tauri.app) · [markdown-it](https://github.com/markdown-it/markdown-it) · [highlight.js](https://highlightjs.org) · [Mermaid](https://mermaid.js.org) · [KaTeX](https://katex.org)

## License

MIT
