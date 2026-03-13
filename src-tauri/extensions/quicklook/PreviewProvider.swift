import Cocoa
import Quartz
import WebKit

class PreviewViewController: NSViewController, QLPreviewingController {
    var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "javaScriptEnabled")

        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 600, height: 400), configuration: config)
        webView.autoresizingMask = [.width, .height]

        self.view = webView
    }

    private static let codeLanguages: [String: String] = [
        "js": "javascript",
        "json": "json",
        "xml": "xml",
        "yaml": "yaml",
        "yml": "yaml",
    ]

    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        do {
            let raw = try String(contentsOf: url, encoding: .utf8)
            let language = Self.codeLanguages[url.pathExtension.lowercased()]
            let markdown = language != nil ? "```\(language!)\n\(raw)\n```" : raw
            let html = buildHTML(markdown: markdown, isCodeFile: language != nil)

            let tempFile = FileManager.default.temporaryDirectory
                .appendingPathComponent("yamv-ql-\(ProcessInfo.processInfo.globallyUniqueString).html")
            try html.write(to: tempFile, atomically: true, encoding: .utf8)

            webView.loadFileURL(tempFile, allowingReadAccessTo: URL(fileURLWithPath: "/"))
            handler(nil)
        } catch {
            handler(error)
        }
    }

    private func buildHTML(markdown: String, isCodeFile: Bool = false) -> String {
        let rendererJS = loadResource("renderer", ext: "js")
        let stylesCSS = loadResource("styles", ext: "css")

        let markdownData = markdown.data(using: .utf8) ?? Data()
        let base64Markdown = markdownData.base64EncodedString()

        let hasMermaid = markdown.contains("```mermaid")
        let mermaidScript = hasMermaid ? "<script>\(loadResource("mermaid-bundle", ext: "js"))</script>" : ""

        // Security note: innerHTML renders markdown from local files on the user's
        // own filesystem. This is a local-only viewer, not a web application.
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="color-scheme" content="light dark">
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
            if (\(isCodeFile ? "true" : "false")) {
                var pre = el.querySelector('pre');
                if (pre) {
                    var code = pre.querySelector('code');
                    var lines = code.textContent.split('\\n');
                    if (lines[lines.length - 1] === '') lines.pop();
                    var nums = document.createElement('span');
                    nums.className = 'line-numbers';
                    nums.setAttribute('aria-hidden', 'true');
                    var t = '';
                    for (var i = 1; i <= lines.length; i++) t += i + '\\n';
                    nums.textContent = t;
                    pre.insertBefore(nums, code);
                    pre.classList.add('with-line-numbers');
                }
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
