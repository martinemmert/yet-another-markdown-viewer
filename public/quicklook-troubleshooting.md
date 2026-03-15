# QuickLook Troubleshooting

YAMV includes a QuickLook extension that renders markdown files when you press **Space** on a `.md` file in Finder. If you're seeing a basic monospace preview instead of YAMV's styled rendering, another app's QuickLook extension may be taking priority.

## The Problem

macOS allows multiple apps to register QuickLook extensions for the same file type. When more than one extension claims `.md` files — for example **Bear**, **MarkEdit**, or other markdown apps — macOS picks one, and it may not be YAMV's.

## Fix via System Settings

1. Open **System Settings**
2. Go to **Privacy & Security → Extensions → Quick Look**
3. Make sure **YAMV QuickLook** is checked
4. If another app's QuickLook extension is also checked (e.g. Bear, MarkEdit), uncheck it to prevent conflicts

## Fix via Terminal

You can also manage QuickLook extensions from the Terminal.

**Disable a competing extension:**

```sh
# Disable Bear's QuickLook extension
pluginkit -e ignore -i net.shinyfrog.bear.Bear-Quicklook-Extension

# Disable MarkEdit's QuickLook extension
pluginkit -e ignore -i app.cyan.markedit.preview-extension
```

**Re-enable an extension you disabled:**

```sh
pluginkit -e use -i net.shinyfrog.bear.Bear-Quicklook-Extension
```

**List all registered QuickLook extensions:**

```sh
pluginkit -mDA -p com.apple.quicklook.preview
```

Extensions marked with `+` are enabled.

**Reset the QuickLook cache** (sometimes needed after changes):

```sh
qlmanage -r && qlmanage -r cache
```

## After Reinstalling YAMV

If you reinstalled YAMV (e.g. after an update that required a fresh install), the QuickLook extension may need to be re-registered. Open the app once — macOS should discover the extension automatically. If not, run:

```sh
qlmanage -r && qlmanage -r cache
```

Then check System Settings to make sure YAMV QuickLook is enabled.
