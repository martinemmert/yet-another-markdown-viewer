import markdownit from "markdown-it";
import footnote from "markdown-it-footnote";
import { full as emoji } from "markdown-it-emoji";
import abbr from "markdown-it-abbr";
import deflist from "markdown-it-deflist";
import anchor from "markdown-it-anchor";
import tocDoneRight from "markdown-it-toc-done-right";
import taskLists from "markdown-it-task-lists";
import mark from "markdown-it-mark";
import frontMatter from "markdown-it-front-matter";
import hljs from "highlight.js";
import katex from "katex";

let frontMatterContent = null;

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str, lang) {
    // Preserve language class for mermaid so postRender can find it
    if (lang === "mermaid") {
      return `<pre><code class="language-mermaid">${md.utils.escapeHtml(str)}</code></pre>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch (_) {
        /* fallback below */
      }
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
md.use(anchor, { permalink: anchor.permalink.headerLink() });
md.use(tocDoneRight);
md.use(frontMatter, (fm) => {
  frontMatterContent = fm;
});

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
    if (state.src.slice(lineStart, lineEnd).trim() === "$$") {
      found = true;
      break;
    }
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

const postRenderHooks = [];

export function addPostRenderHook(fn) {
  postRenderHooks.push(fn);
}

function renderFrontMatter(fm) {
  if (!fm) return "";
  return `<details class="front-matter"><summary>Front Matter</summary><pre><code class="language-yaml">${md.utils.escapeHtml(fm)}</code></pre></details>`;
}

export function render(markdown) {
  frontMatterContent = null;
  const html = md.render(markdown);
  const fmHtml = renderFrontMatter(frontMatterContent);
  return fmHtml + html;
}

export async function postRender(container) {
  const mermaidBlocks = container.querySelectorAll("code.language-mermaid");
  if (mermaidBlocks.length > 0) {
    const mermaid = (await import("mermaid")).default;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: isDark
        ? {
            // Dark Graphite
            background: "#1c1e20",
            primaryColor: "#292c2e",
            primaryTextColor: "#d8d8d8",
            primaryBorderColor: "#4c4c4c",
            secondaryColor: "#3a3d40",
            secondaryTextColor: "#d8d8d8",
            secondaryBorderColor: "#4c4c4c",
            tertiaryColor: "#3a3d40",
            tertiaryTextColor: "#d8d8d8",
            tertiaryBorderColor: "#4c4c4c",
            lineColor: "#74bef7",
            textColor: "#d8d8d8",
            mainBkg: "#292c2e",
            nodeBorder: "#74bef7",
            clusterBkg: "#1c1e20",
            clusterBorder: "#4c4c4c",
            titleColor: "#c6d5e0",
            edgeLabelBackground: "#292c2e",
            nodeTextColor: "#d8d8d8",
            actorBkg: "#292c2e",
            actorBorder: "#74bef7",
            actorTextColor: "#d8d8d8",
            actorLineColor: "#74bef7",
            signalColor: "#d8d8d8",
            signalTextColor: "#d8d8d8",
            labelBoxBkgColor: "#292c2e",
            labelBoxBorderColor: "#4c4c4c",
            labelTextColor: "#d8d8d8",
            loopTextColor: "#d8d8d8",
            noteBkgColor: "#3a3d40",
            noteBorderColor: "#4c4c4c",
            noteTextColor: "#d8d8d8",
            activationBkgColor: "#3a3d40",
            activationBorderColor: "#74bef7",
            sequenceNumberColor: "#1c1e20",
            sectionBkgColor: "#292c2e",
            altSectionBkgColor: "#3a3d40",
            sectionBkgColor2: "#3a3d40",
            taskBkgColor: "#74bef7",
            taskBorderColor: "#74bef7",
            taskTextColor: "#1c1e20",
            taskTextLightColor: "#d8d8d8",
            taskTextDarkColor: "#1c1e20",
            activeTaskBkgColor: "#61afef",
            activeTaskBorderColor: "#61afef",
            doneTaskBkgColor: "#98c379",
            doneTaskBorderColor: "#98c379",
            critBkgColor: "#e06c75",
            critBorderColor: "#e06c75",
            todayLineColor: "#74bef7",
            pie1: "#74bef7",
            pie2: "#98c379",
            pie3: "#e5c07b",
            pie4: "#e06c75",
            pie5: "#d19a66",
            pie6: "#56b6c2",
            pie7: "#c678dd",
            pie8: "#61afef",
            pie9: "#636d83",
            pie10: "#4c4c4c",
            pie11: "#3a3d40",
            pie12: "#292c2e",
          }
        : {
            // Red Graphite
            background: "#fafafa",
            primaryColor: "#f0f0f0",
            primaryTextColor: "#2c2c2c",
            primaryBorderColor: "#d7d7d7",
            secondaryColor: "#e5e5e5",
            secondaryTextColor: "#2c2c2c",
            secondaryBorderColor: "#d7d7d7",
            tertiaryColor: "#e5e5e5",
            tertiaryTextColor: "#2c2c2c",
            tertiaryBorderColor: "#d7d7d7",
            lineColor: "#cb4d49",
            textColor: "#2c2c2c",
            mainBkg: "#f0f0f0",
            nodeBorder: "#cb4d49",
            clusterBkg: "#fafafa",
            clusterBorder: "#d7d7d7",
            titleColor: "#2c2c2c",
            edgeLabelBackground: "#f0f0f0",
            nodeTextColor: "#2c2c2c",
            actorBkg: "#f0f0f0",
            actorBorder: "#cb4d49",
            actorTextColor: "#2c2c2c",
            actorLineColor: "#cb4d49",
            signalColor: "#2c2c2c",
            signalTextColor: "#2c2c2c",
            labelBoxBkgColor: "#f0f0f0",
            labelBoxBorderColor: "#d7d7d7",
            labelTextColor: "#2c2c2c",
            loopTextColor: "#2c2c2c",
            noteBkgColor: "#f0f0f0",
            noteBorderColor: "#d7d7d7",
            noteTextColor: "#2c2c2c",
            activationBkgColor: "#f0f0f0",
            activationBorderColor: "#cb4d49",
            sequenceNumberColor: "#fafafa",
            sectionBkgColor: "#f0f0f0",
            altSectionBkgColor: "#e5e5e5",
            sectionBkgColor2: "#e5e5e5",
            taskBkgColor: "#cb4d49",
            taskBorderColor: "#cb4d49",
            taskTextColor: "#fafafa",
            taskTextLightColor: "#fafafa",
            taskTextDarkColor: "#2c2c2c",
            activeTaskBkgColor: "#21709a",
            activeTaskBorderColor: "#21709a",
            doneTaskBkgColor: "#448c27",
            doneTaskBorderColor: "#448c27",
            critBkgColor: "#cb4d49",
            critBorderColor: "#cb4d49",
            todayLineColor: "#cb4d49",
            pie1: "#cb4d49",
            pie2: "#21709a",
            pie3: "#448c27",
            pie4: "#c58b00",
            pie5: "#a0306f",
            pie6: "#7c4dff",
            pie7: "#d7d7d7",
            pie8: "#969696",
            pie9: "#e5e5e5",
            pie10: "#f0f0f0",
            pie11: "#2c2c2c",
            pie12: "#fafafa",
          },
    });
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i];
      const pre = block.parentElement;
      const graphDef = block.textContent;
      try {
        const { svg } = await mermaid.render(`mermaid-${i}`, graphDef);
        const div = document.createElement("div");
        div.className = "mermaid-diagram";
        // Safe: SVG generated by Mermaid library from local file content
        div.innerHTML = svg;
        pre.replaceWith(div);
      } catch (e) {
        pre.classList.add("mermaid-error");
      }
    }
  }

  for (const hook of postRenderHooks) {
    await hook(container);
  }
}
