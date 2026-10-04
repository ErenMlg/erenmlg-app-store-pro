#!/usr/bin/env node
/*
Turn a privacy policy written in Markdown into a styled, self-contained web page, ready for
GitHub Pages, so it never has to be restyled by hand in a site builder.

Usage:
    node privacy.mjs <policy.md> <out-dir> [--name Reword] [--accent #f5b301] [--icon icon.png] [--workflow]

Writes <out-dir>/index.html (and copies the icon next to it). With --workflow it also writes
.github/workflows/pages.yml at the git root of <out-dir>: a GitHub Actions job that publishes
only <out-dir>, so nothing else in the repository becomes public. The page lives at
https://<owner>.github.io/<repo>/ when <out-dir> is the published folder.

Markdown supported: # to #### headings, paragraphs, - / 1. lists, | tables |, > quotes, ---,
**bold**, *italic*, `code`, [links](url) and bare https:// links. Every ## heading gets an anchor
and a line in the contents box at the top.
*/

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = text => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>');
}

function toHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [], toc = [];
  let title = null;
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length, text = heading[2].trim();
      if (level === 1 && !title) title = text;
      else {
        const id = slug(text);
        if (level === 2) toc.push({ id, text });
        html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      }
      i++; continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = row => row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      const body = rows.filter(row => !/^\|\s*:?-{2,}/.test(row));
      const [head, ...rest] = body;
      html.push('<div class="table"><table><thead><tr>' + cells(head).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rest.map(row => '<tr>' + cells(row).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    const list = /^(\s*)([-*]|\d+\.)\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[2]);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||>|\s*([-*]|\d+\.)\s|-{3,}\s*$)/.test(lines[i])) para.push(lines[i++].trim());
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { title, toc, body: html.join('\n') };
}

function page({ title, toc, body, name, accent, icon }) {
  const contents = toc.length > 1
    ? `<nav class="toc"><strong>Contents</strong><ul>${toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ul></nav>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || `${name} — Privacy Policy`)}</title>
<meta name="robots" content="index, follow">
${icon ? `<link rel="icon" href="${icon}">` : ''}
<style>
  :root { --bg: #ffffff; --text: #1d1f24; --muted: #5d6270; --line: #e4e6eb; --card: #f6f7f9; --accent: ${accent}; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f1115; --text: #e8eaee; --muted: #a0a6b3; --line: #262a33; --card: #171a20; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }
  header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
  header img { width: 56px; height: 56px; border-radius: 13px; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0; letter-spacing: -0.02em; }
  h2 { font-size: 23px; margin: 44px 0 10px; padding-top: 18px; border-top: 1px solid var(--line); letter-spacing: -0.01em; }
  h3 { font-size: 18px; margin: 28px 0 6px; }
  h4 { font-size: 16px; margin: 20px 0 4px; color: var(--muted); }
  p, li { color: var(--text); }
  a { color: var(--accent); text-underline-offset: 3px; }
  strong { font-weight: 650; }
  code { font: 0.9em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--card); padding: 1px 5px; border-radius: 5px; }
  ul, ol { padding-left: 22px; }
  li { margin: 4px 0; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 36px 0; }
  hr + h2 { border-top: 0; padding-top: 0; margin-top: 0; }
  blockquote { margin: 16px 0; padding: 10px 16px; border-left: 3px solid var(--accent); background: var(--card); border-radius: 0 8px 8px 0; color: var(--muted); }
  .toc { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 20px; margin: 8px 0 8px; }
  .toc ul { margin: 6px 0 0; }
  .table { overflow-x: auto; margin: 14px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  footer { margin-top: 56px; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<main>
<header>${icon ? `<img src="${icon}" alt="">` : ''}<h1>${inline(title || `${name} — Privacy Policy`)}</h1></header>
${contents}
${body}
<footer>${esc(name)}</footer>
</main>
</body>
</html>
`;
}

// Publishes only the given folder; Settings → Pages → Source must be "GitHub Actions".
const WORKFLOW = folder => `name: Publish privacy policy
on:
  push:
    branches: [main]
    paths: ["${folder}/**"]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ${folder}
      - id: deployment
        uses: actions/deploy-pages@v4
`;

function main() {
  const args = process.argv.slice(2);
  const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const [input, outDir] = args.filter((a, i) => !a.startsWith('--') && !/^--(name|accent|icon)$/.test(args[i - 1] || ''));
  if (!input || !outDir) {
    const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    console.log(source.slice(source.indexOf('/*') + 3, source.indexOf('*/')).trim());
    process.exit(1);
  }
  if (!fs.existsSync(input)) { console.error(`policy not found: ${input}`); process.exit(1); }
  const accent = flag('--accent') || '#2563eb';
  if (!/^#[0-9a-f]{3,8}$/i.test(accent)) { console.error(`--accent must be a hex colour, got ${accent}`); process.exit(1); }
  const { title, toc, body } = toHtml(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  let icon = null;
  if (flag('--icon')) {
    const src = flag('--icon');
    if (!fs.existsSync(src)) { console.error(`icon not found: ${src}`); process.exit(1); }
    icon = `icon${path.extname(src)}`;
    fs.copyFileSync(src, path.join(outDir, icon));
  }
  const name = flag('--name') || title?.split(/\s[—-]\s/)[0] || 'App';
  fs.writeFileSync(path.join(outDir, 'index.html'), page({ title, toc, body, name, accent, icon }));
  console.log(`wrote ${path.join(outDir, 'index.html')} (${toc.length} sections)`);
  if (args.includes('--workflow')) {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: outDir, encoding: 'utf8' }).trim();
    const folder = path.relative(root, path.resolve(outDir)).split(path.sep).join('/');
    const file = path.join(root, '.github', 'workflows', 'pages.yml');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, WORKFLOW(folder));
    console.log(`wrote ${path.relative(root, file)} (publishes only ${folder}/)`);
  }
}

main();
