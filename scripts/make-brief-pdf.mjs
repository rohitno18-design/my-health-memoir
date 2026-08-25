// Render the brief to a clean, printable PDF via headless Chrome.
import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const md = readFileSync("docs/DATA-LAYER-BRIEF.md", "utf8");

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Minimal, predictable markdown -> HTML (headings, tables, code, lists, rules)
function render(src) {
  const lines = src.split("\n");
  const out = [];
  let i = 0;
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {                       // fenced code
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\|/.test(line) && /^\|[\s:*-]+\|/.test(lines[i + 1] || "")) {  // table
      const head = line.split("|").slice(1, -1).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map(c => c.trim()));
        i++;
      }
      out.push(
        `<table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>` +
        rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table>`
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push("<hr/>"); i++; continue; }

    if (/^\s*[-*]\s+/.test(line)) {                 // unordered list
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++;
      }
      out.push(`<ul>${buf.map(b => `<li>${inline(b)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {                // ordered list
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++;
      }
      out.push(`<ol>${buf.map(b => `<li>${inline(b)}</li>`).join("")}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {                       // blockquote
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }

    const buf = [];                                  // paragraph
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\||>|\s*[-*]\s|\s*\d+\.\s|---)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1e293b; font-size: 10.5pt; line-height: 1.65; margin: 0; }
  h1 { font-size: 20pt; font-weight: 800; color: #0f172a; margin: 0 0 4pt; letter-spacing: -0.4pt; }
  h2 { font-size: 13pt; font-weight: 800; color: #2563eb; margin: 20pt 0 6pt;
       padding-bottom: 4pt; border-bottom: 1px solid #e2e8f0; page-break-after: avoid; }
  h3 { font-size: 11pt; font-weight: 700; color: #0f172a; margin: 14pt 0 4pt; page-break-after: avoid; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
  li { margin-bottom: 3pt; }
  code { font-family: "SF Mono", Consolas, monospace; font-size: 9pt;
         background: #f1f5f9; padding: 1pt 3pt; border-radius: 3px; color: #0f172a; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
        padding: 9pt 11pt; overflow: hidden; page-break-inside: avoid; margin: 0 0 10pt; }
  pre code { background: none; padding: 0; font-size: 8.5pt; line-height: 1.5; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 10pt; font-size: 9pt; page-break-inside: avoid; }
  th { background: #f1f5f9; text-align: left; font-weight: 700; color: #0f172a;
       padding: 5pt 7pt; border: 1px solid #e2e8f0; }
  td { padding: 5pt 7pt; border: 1px solid #e2e8f0; vertical-align: top; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 14pt 0; }
  blockquote { border-left: 3px solid #cbd5e1; margin: 0 0 8pt; padding: 2pt 0 2pt 10pt; color: #475569; }
  strong { color: #0f172a; font-weight: 700; }
  .cover { border-bottom: 2px solid #2563eb; padding-bottom: 10pt; margin-bottom: 6pt; }
  .meta { color: #64748b; font-size: 9pt; margin: 0; }
</style></head><body>
${render(md).replace(/^<h1>/, '<div class="cover"><h1>').replace(/<hr\/>/, '</div><hr/>')}
</body></html>`;

writeFileSync("_brief.html", html);  // temp, deleted below

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
execFileSync(chrome, [
  "--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer",
  `--print-to-pdf=${resolve("docs/IM-Smrti-Data-Brief.pdf")}`,
  `file:///${resolve("_brief.html").replace(/\\/g, "/")}`,
], { stdio: "pipe", timeout: 120000 });

console.log("PDF written");

// tidy up the intermediate file
try { (await import("fs")).unlinkSync("_brief.html"); } catch { /* ignore */ }
