#!/usr/bin/env node
/*
Render store screenshots from an HTML template with headless Chrome.

Each image is an HTML page (assets/template.html, or your own copy of it)
opened at the exact canvas size and screenshotted. The app screenshot is a
plain <img> in that page, so the UI is never regenerated, only resized.

Needs Node 18+ and a Chromium-based browser (Chrome, Chromium, Edge, Brave).
Set CHROME_PATH if it is not found. No npm packages.

Usage:
    node render.mjs set.json

set.json (renders into <out_root>/store/<target>/, e.g. store/apple/iphone/):
    {
      "targets": ["apple/iphone", "google/phone"],
      "out_root": "path/to/the/app/project",
      "template": "optional/path/to/custom-template.html",
      "theme": {
        "bg": "#1b1145", "bg2": "#0d0824",
        "accent": "#7c3aed", "accent2": "#f3c969",
        "text": "#ffffff", "line": "rgba(255,255,255,.2)",
        "headline_font": "\"Didot\", \"Playfair Display\", Georgia, serif",
        "headline_weight": 700, "em_style": "italic",
        "font_links": ["https://fonts.googleapis.com/css2?family=..."],
        "platform": "ios", "cutout": true, "frame": "black",
        "headline_lines": 2, "sub_lines": 2, "device_max_w": 0.73,
        "scene": "scene.html", "scene_vars": {"seed": 1}
      },
      "images": [
        {"screenshot": "raw/home.png", "headline": "Art history,\n*made playable.*",
         "sub": "Optional one-sentence subheadline.",
         "pattern": "rings", "scene_vars": {"seed": 4}, "out": "01-home.png"}
      ],
      "icon": "assets/icon.png",
      "feature_graphic": {"name": "Reword", "tagline": "Say it *better*."}
    }

"icon" (optional) is the app's square logo, 1024 px or larger. It is written to
store/apple/icon.png (1024x1024) and store/google/icon.png (512x512), opaque:
transparent areas get the theme's bg. "feature_graphic" (optional, needs "icon")
renders the Google Play 1024x500 banner to store/google/feature-graphic.png with
the icon, "name" and "tagline" (*text* = accent) on the theme background.

Headline markup: "\n" is a line break, *text* gets the accent treatment.
Any theme key can be overridden per image. Paths may be absolute, start with
"~", or be relative to the config file.

Backgrounds, pick one:
  "scene"             HTML fragment injected into the background layer. It may
                      contain <style>, markup, inline <svg> and <script>.
                      "scene_vars" (theme and image, merged) reach it as
                      window.SCENE. After layout the page sets window.LAYOUT and
                      fires a "store:layout" event with the canvas, device and
                      screen boxes in pixels.
  "background_image"  photo, artwork or illustration; "scrim" (0..1) tints it
                      toward bg, "background_position" is a CSS position.
  "pattern"           rings, dots, grid, rays, arcs, diagonal, frames, none.
*/

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BROWSERS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const BROWSER_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
                          'microsoft-edge', 'brave-browser'];

const THEME_DEFAULTS = {
  bg: '#15151c', bg2: null, accent: '#6d5efc', accent2: null, text: null, line: null,
  headline_font: '"SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headline_weight: 700, em_style: 'normal', font_links: [],
  platform: 'ios', cutout: true, headline_lines: 2, device_max_w: 0.78,
  frame: 'silver', sub_lines: 0, scrim: 0.35,
  background_image: null, background_position: 'center', scene: null,
  mode: 'single', rotation: 'flat', frame2: null,
  headline_align: 'left', device_bleed: 0, glow: true, grain: false, sparkles: true,
};

// Perspective presets applied to the device(s) via CSS transform. flat = none.
const ROTATIONS = new Set(['flat', 'subtle', 'left', 'right', 'dual']);

// Store screenshot targets. Each renders the whole set at that canvas size into
// <out_root>/store/<dir>/. Apple wants specific device sizes; Google Play accepts any
// 9:16 portrait within its bounds. The app icon and the feature graphic are not
// screenshots; renderExtras() writes them from the "icon" and "feature_graphic" keys.
// `bleed` = how much of the phone may run off the bottom. Tall 9:16-ish canvases can
// afford a big bleed (PocketPal look); a wide canvas (iPad 3:4) must keep it near zero
// or the phone's lower half gets cut off. Used as the default device_bleed per target.
const TARGETS = {
  'apple/iphone':    { dir: 'apple/iphone',     size: [1206, 2622], platform: 'ios',     bleed: 0.06 },
  'apple/ipad':      { dir: 'apple/ipad',       size: [2048, 2732], platform: 'ios',     bleed: 0 },
  'google/phone':    { dir: 'google/phone',     size: [1080, 1920], platform: 'android', bleed: 0.06 },
  'google/tablet7':  { dir: 'google/tablet-7',  size: [1080, 1920], platform: 'android', bleed: 0.06 },
  'google/tablet10': { dir: 'google/tablet-10', size: [1440, 2560], platform: 'android', bleed: 0.06 },
  'google/desktop':  { dir: 'google/desktop',   size: [1440, 2560], platform: 'android', bleed: 0.06 },
  'google/xr':       { dir: 'google/xr',        size: [1080, 1920], platform: 'android', bleed: 0.06 },
};
const DEFAULT_TARGETS = ['apple/iphone', 'google/phone'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const candidate of BROWSERS) if (fs.existsSync(candidate)) return candidate;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const name of BROWSER_COMMANDS) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  fail('No Chromium-based browser found. Install Chrome or set CHROME_PATH.');
}

function resolvePath(value, baseDir) {
  const expanded = value.startsWith('~') ? path.join(os.homedir(), value.slice(1)) : value;
  return path.isAbsolute(expanded) ? expanded : path.join(baseDir, expanded);
}

const escapeHtml = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function isDark(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return true;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

function headlineHtml(text) {
  return escapeHtml(text.replace(/\\n/g, '\n'))
    .replace(/\*([\s\S]+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Fill the colors a theme may leave out, derived from bg.
function deriveColors(t) {
  const dark = isDark(t.bg);
  t.bg2 ??= `color-mix(in srgb, ${t.bg} 72%, ${dark ? '#000' : '#fff'})`;
  t.accent2 ??= t.accent;
  t.text ??= dark ? '#ffffff' : '#111114';
  t.line ??= dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.1)';
  return t;
}

function buildPage(template, theme, image, baseDir, size) {
  const t = { ...THEME_DEFAULTS, ...theme };
  for (const key of Object.keys(THEME_DEFAULTS)) if (key in image) t[key] = image[key];
  deriveColors(t);

  const shot = resolvePath(image.screenshot, baseDir);
  if (!fs.existsSync(shot)) fail(`screenshot not found: ${shot}`);

  // dual mode needs a second screenshot (typically the dark-mode counterpart)
  const dual = t.mode === 'dual';
  let shot2 = '';
  if (dual) {
    if (!image.screenshot2) fail(`mode "dual" needs "screenshot2" on image ${image.out || image.screenshot}`);
    const p = resolvePath(image.screenshot2, baseDir);
    if (!fs.existsSync(p)) fail(`screenshot2 not found: ${p}`);
    shot2 = pathToFileURL(p).href;
  }
  if (!ROTATIONS.has(t.rotation)) fail(`unknown rotation "${t.rotation}"; use ${[...ROTATIONS].join(', ')}`);

  let bgImage = 'none';
  if (t.background_image) {
    const bgPath = resolvePath(t.background_image, baseDir);
    if (!fs.existsSync(bgPath)) fail(`background image not found: ${bgPath}`);
    bgImage = `url("${pathToFileURL(bgPath).href}")`;
  }

  // An HTML scene fragment is injected first so it can use the same {{PLACEHOLDERS}}.
  let sceneHtml = '';
  if (t.scene) {
    const scenePath = resolvePath(t.scene, baseDir);
    if (!fs.existsSync(scenePath)) fail(`scene not found: ${scenePath}`);
    const sceneVars = { ...(theme.scene_vars || {}), ...(image.scene_vars || {}) };
    sceneHtml = `<script>window.SCENE = ${JSON.stringify(sceneVars)};</script>\n${fs.readFileSync(scenePath, 'utf8')}`;
  }

  const values = {
    WIDTH: size[0], HEIGHT: size[1],
    BG: t.bg, BG2: t.bg2, ACCENT: t.accent, ACCENT2: t.accent2, TEXT: t.text, LINE: t.line,
    HEADLINE_FONT: t.headline_font, HEADLINE_WEIGHT: t.headline_weight, EM_STYLE: t.em_style,
    HEADLINE_LINES: t.headline_lines, DEVICE_MAX_W: t.device_max_w,
    FONT_LINKS: t.font_links.map(u => `<link rel="stylesheet" href="${escapeHtml(u)}">`).join('\n'),
    PATTERN: image.pattern || 'none',
    BG_IMAGE_CSS: bgImage, BG_POSITION: t.background_position,
    PHOTO_CLASS: t.background_image ? 'has-photo' : '', SCENE_CLASS: t.scene ? 'has-scene' : '',
    SCRIM: t.scrim, FRAME: t.frame,
    SUB_LINES: t.sub_lines || (image.sub ? 2 : 0), SUB_HTML: escapeHtml(image.sub || ''),
    PLATFORM: t.platform, CUTOUT_CLASS: t.cutout ? '' : 'no-cutout',
    EYEBROW: escapeHtml(image.eyebrow || ''), HEADLINE_HTML: headlineHtml(image.headline || ''),
    SCREENSHOT: pathToFileURL(shot).href,
    SCREENSHOT2: shot2, MODE: t.mode, ROTATION: dual ? 'dual' : t.rotation,
    MODE_CLASS: dual ? 'is-dual' : 'is-single', FRAME2: t.frame2 || t.frame,
    HEADLINE_ALIGN: t.headline_align, DEVICE_BLEED: t.device_bleed,
    FX_CLASS: [t.glow === false ? 'no-glow' : '', t.grain ? 'has-grain' : '', t.sparkles === false ? 'no-sparkle' : ''].filter(Boolean).join(' '),
    CALLOUTS_HTML: (image.callouts || []).map(c =>
      `<div class="callout${c.accent ? ' accent' : ''}" data-at="${c.at || 'top-left'}">` +
      `${c.dot === false ? '' : '<span class="cdot"></span>'}${escapeHtml(c.text)}</div>`).join('\n'),
  };
  let page = template.split('{{SCENE_HTML}}').join(sceneHtml);
  for (const [key, value] of Object.entries(values)) page = page.split(`{{${key}}}`).join(String(value));
  return { page, theme: t };
}

/*
Screenshot url to out and return the dumped DOM plus any page script errors.

One run does both, so the reported geometry belongs to the captured frame.
Chrome finishes the work but does not always exit on its own (seen on macOS
and in sandboxed shells), so poll for the result instead of waiting for exit.
*/
async function chrome(browser, workDir, size, url, out, timeoutMs = 90000) {
  const domPath = path.join(workDir, 'chrome-stdout.txt');
  const errPath = path.join(workDir, 'chrome-stderr.txt');
  const stdout = fs.openSync(domPath, 'w');
  const stderr = fs.openSync(errPath, 'w');
  const proc = spawn(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--enable-logging=stderr', `--user-data-dir=${path.join(workDir, 'profile')}`,
    '--force-device-scale-factor=1', `--window-size=${size[0]},${size[1]}`, '--virtual-time-budget=10000',
    `--screenshot=${out}`, '--dump-dom', url,
  ], { stdio: ['ignore', stdout, stderr] });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  proc.on('error', error => fail(`could not start the browser: ${error.message}`));

  const sizes = [];
  const deadline = Date.now() + timeoutMs;
  while (!exited && Date.now() < deadline) {
    await sleep(250);
    sizes.push(fs.existsSync(out) ? fs.statSync(out).size : 0);
    const settled = sizes.length >= 3 && sizes.at(-1) > 0 && sizes.at(-1) === sizes.at(-2) && sizes.at(-1) === sizes.at(-3);
    if (settled && fs.readFileSync(domPath, 'utf8').includes('</html>')) break;
  }
  if (!exited) {
    proc.kill('SIGTERM');
    for (let i = 0; i < 20 && !exited; i++) await sleep(250);
    if (!exited) proc.kill('SIGKILL');
  }
  fs.closeSync(stdout);
  fs.closeSync(stderr);
  // JavaScript errors from the page (a broken scene or template) show up as console lines
  const jsErrors = [...fs.readFileSync(errPath, 'utf8').matchAll(/CONSOLE[:(]\d+\)?\] "((?:Uncaught|Error)[^"]*)"/g)].map(m => m[1]);
  return { dom: fs.readFileSync(domPath, 'utf8'), jsErrors };
}

// Both stores reject transparency. Chrome writes opaque pages as RGB; confirm it, and the size.
function checkPng(file, size) {
  const header = fs.readFileSync(file).subarray(0, 26);
  const [width, height, colorType] = [header.readUInt32BE(16), header.readUInt32BE(20), header[25]];
  const warnings = [];
  if (width !== size[0] || height !== size[1]) warnings.push(`browser produced ${width}x${height}, expected ${size[0]}x${size[1]}`);
  if (colorType === 4 || colorType === 6) warnings.push('PNG has an alpha channel; give the page an opaque background and re-render');
  return warnings;
}

// The app icon for both stores and the Play feature graphic, under <projectRoot>/store/.
async function renderExtras(config, baseDir, skillDir, projectRoot, browser) {
  if (!config.icon && !config.feature_graphic) return [];
  if (!config.icon) fail('"feature_graphic" needs "icon"');
  const iconPath = resolvePath(config.icon, baseDir);
  if (!fs.existsSync(iconPath)) fail(`icon not found: ${iconPath}`);
  const icon = pathToFileURL(iconPath).href;
  const t = deriveColors({ ...THEME_DEFAULTS, ...(config.theme || {}) });

  const iconPage = px => `<!doctype html><html><body style="margin:0;background:${t.bg}">` +
    `<img src="${icon}" style="display:block;width:${px}px;height:${px}px;object-fit:cover"><script>` +
    `const i=document.querySelector('img');const r=()=>document.documentElement.setAttribute('data-meta',` +
    `JSON.stringify({icon_px:i.naturalWidth}));i.complete?r():i.addEventListener('load',r);</script></body></html>`;
  const jobs = [
    { out: 'apple/icon.png', size: [1024, 1024], page: iconPage(1024) },
    { out: 'google/icon.png', size: [512, 512], page: iconPage(512) },
  ];
  if (config.feature_graphic) {
    const { name, tagline = '' } = config.feature_graphic;
    if (!name) fail('"feature_graphic" needs "name"');
    const values = {
      BG: t.bg, BG2: t.bg2, ACCENT: t.accent, ACCENT2: t.accent2, TEXT: t.text,
      HEADLINE_FONT: t.headline_font, HEADLINE_WEIGHT: t.headline_weight, EM_STYLE: t.em_style,
      FONT_LINKS: t.font_links.map(u => `<link rel="stylesheet" href="${escapeHtml(u)}">`).join('\n'),
      ICON: icon, NAME: escapeHtml(name), TAGLINE_HTML: headlineHtml(tagline),
    };
    let page = fs.readFileSync(path.join(skillDir, 'assets', 'feature.html'), 'utf8');
    for (const [key, value] of Object.entries(values)) page = page.split(`{{${key}}}`).join(String(value));
    jobs.push({ out: 'google/feature-graphic.png', size: [1024, 500], page });
  }

  const storeDir = path.join(projectRoot, 'store');
  fs.mkdirSync(storeDir, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(storeDir, '.work-'));
  const results = [];
  try {
    for (const [index, job] of jobs.entries()) {
      const out = path.join(storeDir, job.out);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.rmSync(out, { force: true });
      const pagePath = path.join(workDir, `extra-${index + 1}.html`);
      fs.writeFileSync(pagePath, job.page);
      const { dom, jsErrors } = await chrome(browser, workDir, job.size, pathToFileURL(pagePath).href, out);
      if (!fs.existsSync(out)) fail(`browser produced no image for ${job.out}`);
      const match = /data-meta="([^"]+)"/.exec(dom);
      const meta = match ? JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : {};
      const warnings = [...checkPng(out, job.size), ...jsErrors.map(e => `page script error: ${e}`)];
      if (!meta.icon_px) warnings.push('icon did not load; check the icon path and format');
      else if (job.out.endsWith('icon.png') && meta.icon_px < job.size[0]) warnings.push(`icon was upscaled from ${meta.icon_px} px; use a 1024 px source`);
      if (job.out === 'google/icon.png' && fs.statSync(out).size > 1024 * 1024) warnings.push('over 1 MB; Google Play rejects larger icons');
      results.push({ target: 'extra', out, canvas: job.size, ...meta, warnings });
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  return results;
}

async function main() {
  const arg = process.argv[2];
  if (!arg || arg === '-h' || arg === '--help') {
    const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    console.log(source.slice(source.indexOf('/*') + 3, source.indexOf('*/')).trim());
    process.exit(arg ? 0 : 1);
  }
  const configPath = path.resolve(resolvePath(arg, process.cwd()));
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const baseDir = path.dirname(configPath);
  const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

  const templatePath = config.template ? resolvePath(config.template, baseDir) : path.join(skillDir, 'assets', 'template.html');
  const template = fs.readFileSync(templatePath, 'utf8');

  // Each target renders the whole set at its own canvas size into store/<dir>/.
  const targetKeys = config.targets || DEFAULT_TARGETS;
  for (const key of targetKeys) if (!TARGETS[key]) fail(`unknown target "${key}"; use one of: ${Object.keys(TARGETS).join(', ')}`);
  // out_root is the app's project folder (default: the config's folder); the tree goes
  // under a `store/` subfolder there, e.g. <project>/store/apple/iphone/.
  const projectRoot = resolvePath(config.out_root || '.', baseDir);
  const browser = findBrowser();
  const results = [];

  for (const key of targetKeys) {
    const { dir, size, platform, bleed } = TARGETS[key];
    // The target decides the phone frame (Apple → iPhone, Google → Android) and the
    // default bleed for its aspect. An explicit theme.device_bleed still wins.
    const theme = { ...(config.theme || {}), platform };
    if (theme.device_bleed === undefined) theme.device_bleed = bleed;
    const outDir = path.join(projectRoot, 'store', dir);
    fs.mkdirSync(outDir, { recursive: true });
    // Some machines block writes to the OS temp dir (antivirus/sandbox), which stops
    // headless Chrome from creating its profile there. The output dir is always
    // writable (the PNGs land there), so put the scratch profile beside them.
    const workDir = fs.mkdtempSync(path.join(outDir, '.work-'));
    try {
      for (const [index, image] of config.images.entries()) {
        const { page } = buildPage(template, theme, image, baseDir, size);
        const pagePath = path.join(workDir, `page-${index + 1}.html`);
        fs.writeFileSync(pagePath, page);
        const out = path.join(outDir, image.out || `${String(index + 1).padStart(2, '0')}.png`);
        fs.rmSync(out, { force: true });

        const { dom, jsErrors } = await chrome(browser, workDir, size, pathToFileURL(pagePath).href, out);
        if (!fs.existsSync(out)) fail(`browser produced no screenshot for ${key}/${path.basename(out)}`);
        const match = /data-meta="([^"]+)"/.exec(dom);
        const meta = match ? JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : {};

        const warnings = [...checkPng(out, size), ...jsErrors.map(e => `page script error: ${e}`)];
        if (!match) warnings.push('page never reported ready; check the screenshot path, fonts, and page script errors');
        if ((meta.screenshot_scale || 0) > 1.05) warnings.push('screenshot was upscaled; use a higher-resolution source or a smaller device_max_w');
        if (key.startsWith('google/') && Math.max(...size) > 2 * Math.min(...size)) {
          warnings.push('long side exceeds 2x the short side; Google Play would reject this size');
        }
        results.push({ target: key, out, canvas: size, ...meta, warnings });
        if (config.keep_html) fs.copyFileSync(pagePath, out.replace(/\.png$/i, '.html'));
      }
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  }
  results.push(...await renderExtras(config, baseDir, skillDir, projectRoot, browser));
  console.log(JSON.stringify(results, null, 2));
}

main();
