import Cocoa
import Quartz
import WebKit

class PreviewViewController: NSViewController, QLPreviewingController {
    var webView: WKWebView!

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 600, height: 400))
        container.autoresizingMask = [.width, .height]
        container.wantsLayer = true

        // Match the HTML background color so there's no flash during page load
        let isDark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        container.layer?.backgroundColor = isDark
            ? NSColor(red: 0.11, green: 0.118, blue: 0.125, alpha: 1).cgColor  // #1c1e20
            : NSColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1).cgColor    // #fafafa

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "javaScriptEnabled")

        webView = WKWebView(frame: container.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        container.addSubview(webView)

        self.view = container
    }

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        do {
            let markdown = try String(contentsOf: url, encoding: .utf8)
            let isDark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            let html = buildHTML(markdown: markdown, isDark: isDark)

            let tempFile = FileManager.default.temporaryDirectory
                .appendingPathComponent("yamv-ql-\(ProcessInfo.processInfo.globallyUniqueString).html")
            try html.write(to: tempFile, atomically: true, encoding: .utf8)

            webView.loadFileURL(tempFile, allowingReadAccessTo: URL(fileURLWithPath: "/"))
            handler(nil)
        } catch {
            handler(error)
        }
    }

    private func buildHTML(markdown: String, isDark: Bool) -> String {
        let rendererJS = loadResource("renderer", ext: "js")
        let stylesCSS = loadResource("styles", ext: "css")

        // Encode markdown as base64 to avoid any escaping issues
        let markdownData = markdown.data(using: .utf8) ?? Data()
        let base64Markdown = markdownData.base64EncodedString()

        // Only include the heavy Mermaid bundle (~3.5MB) if the markdown contains mermaid blocks
        let hasMermaid = markdown.contains("```mermaid")
        let mermaidScript = hasMermaid ? "<script>\(loadResource("mermaid-bundle", ext: "js"))</script>" : ""

        let theme = isDark ? "dark" : "light"

        return """
        <!DOCTYPE html>
        <html data-theme="\(theme)">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="\(theme)">
        <style>html{background:var(--color-canvas-default)}</style>
        <style>\(stylesCSS)</style>
        </head>
        <body>
        <div id="content" class="markdown-body"></div>
        <script>\(rendererJS)</script>
        \(mermaidScript)
        <script>
        (function() {
            var md = atob('\(base64Markdown)');
            md = decodeURIComponent(Array.prototype.map.call(md, function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            var el = document.getElementById('content');
            el.innerHTML = window.renderMarkdown(md);
            if (el.querySelector('code.language-mermaid')) {
                requestAnimationFrame(function() { window.renderMermaid(el); });
            }
        })();
        </script>
        </body>
        </html>
        """
    }

    private func loadResource(_ name: String, ext: String) -> String {
        guard let url = Bundle(for: PreviewViewController.self).url(forResource: name, withExtension: ext),
              let content = try? String(contentsOf: url, encoding: .utf8) else {
            return ""
        }
        return content
    }
}
