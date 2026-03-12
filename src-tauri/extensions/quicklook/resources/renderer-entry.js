// Standalone markdown renderer for QuickLook extension
// This gets bundled into a single IIFE that exposes window.renderMarkdown()
// Mermaid is loaded separately on demand to keep this bundle lean (~500KB vs ~4MB)

import markdownit from "markdown-it";
import footnote from "markdown-it-footnote";
import { full as emoji } from "markdown-it-emoji";
import abbr from "markdown-it-abbr";
import deflist from "markdown-it-deflist";
import taskLists from "markdown-it-task-lists";
import mark from "markdown-it-mark";
import hljs from "highlight.js";
import katex from "katex";

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    if (lang === "mermaid") {
      return `<pre><code class="language-mermaid">${md.utils.escapeHtml(str)}</code></pre>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch (_) { /* fallback */ }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

md.use(footnote);
md.use(emoji);
md.use(abbr);
md.use(deflist);
md.use(taskLists, { enabled: false });
md.use(mark);

// KaTeX inline math: $...$
function mathInline(state, silent) {
  if (state.src[state.pos] !== "$") return false;
  if (state.src[state.pos + 1] === "$") return false;
  const start = state.pos + 1;
  let end = start;
  while (end < state.posMax && state.src[end] !== "$") {
    if (state.src[end] === "\\") end++;
    end++;
  }
  if (end >= state.posMax) return false;
  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, end);
  }
  state.pos = end + 1;
  return true;
}

// KaTeX block math: $$...$$
function mathBlock(state, startLine, endLine, silent) {
  const startPos = state.bMarks[startLine] + state.tShift[startLine];
  if (startPos + 2 > state.eMarks[startLine]) return false;
  if (state.src.slice(startPos, startPos + 2) !== "$$") return false;
  if (silent) return true;
  let nextLine = startLine;
  let found = false;
  while (++nextLine < endLine) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineEnd = state.eMarks[nextLine];
    if (state.src.slice(lineStart, lineEnd).trim() === "$$") { found = true; break; }
  }
  if (!found) return false;
  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = state.getLines(startLine + 1, nextLine, state.tShift[startLine], true);
  token.map = [startLine, nextLine + 1];
  token.markup = "$$";
  state.line = nextLine + 1;
  return true;
}

md.inline.ruler.after("escape", "math_inline", mathInline);
md.block.ruler.after("blockquote", "math_block", mathBlock, {
  alt: ["paragraph", "reference", "blockquote", "list"],
});

md.renderer.rules.math_inline = (tokens, idx) => {
  try {
    return katex.renderToString(tokens[idx].content, { throwOnError: false });
  } catch (e) {
    return `<span class="katex-error">${md.utils.escapeHtml(tokens[idx].content)}</span>`;
  }
};

md.renderer.rules.math_block = (tokens, idx) => {
  try {
    return `<div class="katex-block">${katex.renderToString(tokens[idx].content, {
      throwOnError: false,
      displayMode: true,
    })}</div>`;
  } catch (e) {
    return `<div class="katex-error">${md.utils.escapeHtml(tokens[idx].content)}</div>`;
  }
};

window.renderMarkdown = function(markdown) {
  return md.render(markdown);
};

// Mermaid is loaded separately — window.renderMermaid is set by mermaid-entry.js
window.renderMermaid = async function() {};
