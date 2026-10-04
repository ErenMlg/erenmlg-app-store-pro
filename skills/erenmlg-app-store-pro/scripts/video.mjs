#!/usr/bin/env node
/*
Build store videos as HyperFrames compositions, render them, and finalize each
to its store's delivery spec.

Usage:
    node video.mjs store/video.json [--only google,ios-promo] [--fast]

    --only   render just these stores (overrides "stores" in the config)
    --fast   for iterating: skip `hyperframes check`, render at draft quality and encode faster.
             Iterate on one store with --only google --fast (about a minute), and render every
             store once, without --fast, when the film is approved.

Each render also writes store/.video/<store>/review.png: one small frame per second of the film, for checking it
without reading full-size frames.

video.json:
    {
      "out_root": "..",                     app project folder (default: the config's folder)
      "stores": ["google", "apple", "ios-promo"],   which videos to make (default: all three)
      "suffix": "en",                       optional, for a second language: promo-en.mp4, preview-en.mp4
      "currency": "$",                      symbol on the coins and notes that fly into the phone
      "style": "cinematic",                 bold (default), minimal, neon, playful or cinematic — see styles.mjs
      "name": "Monysa", "tagline": "Maaş gününden maaş gününe",
      "icon": "../assets/icon/app.png",     optional, on the Google outro card
      "theme": { "bg": "#0B1220", "bg2": "#15243B", "accent": "#22C55E", "accent2": "#FBBF24", "text": "#ffffff" },
      "music": "synth",                     "synth" (generated here, royalty-free), a licensed file, or null
      "crop": { "top": 76, "bottom": 132 },  status and navigation bar pixels to cut from recordings
      "story": {
        "hook": { "lines": ["Maaş yattı.", "Peki ay sonunda\n*ne kalacak?*"], "seconds": 2.5,
                  "apple_shots": [ { "src": "../raw/video/take.mp4", "from": 0, "to": 2.5 } ] },
        "chapters": ["Gör", "Ekle", "Planla", "Biriktir"],
        "scenes": [
          { "chapter": 0, "caption": "Tüm ay *tek ekranda*.",
            "shots": [ { "src": "../raw/video/take.mp4", "from": 0, "to": 3.125 } ],
            "apple_shots": [ ... ],                     optional Apple footage
            "receipt": { "src": "../assets/fixtures/receipt.png", "crop": [0, 30, 740, 1080], "at": 1.0 },
            "coins": { "at": 0.2, "y": 0.2, "count": 8 } },    money flying into the phone, aimed at y
          or "burst": { "at": 0.2, "y": 0.4, "glyphs": ["❤️", "⭐"] }   the same flight for any other app
          { "trust": true, "caption": "Hesap yok. *Verin sende.*", "shots": [ ... ] }
        ],
        "outro": { "seconds": 3.75, "cta": "Hemen indir" }
      }
    }

Scene length is the sum of its shots, so cut shots to the music: at the synth's 96 BPM a beat is
0.625 s. Google gets the full film; Apple gets screen captures only (see story.mjs).

Writes <out_root>/store/google/video/promo.mp4 (Google Play), <out_root>/store/apple/video/preview.mp4
(the App Store app preview: screen captures only) and <out_root>/store/apple/video/promo.mp4 (the same
film as Google's at iPhone size, for the web, social and ads; not for App Store Connect).
Each HyperFrames project stays in <out_root>/store/.video/<store>/ for preview and edits.
Needs Node 22+, FFmpeg and FFprobe on PATH, and HyperFrames through npx.
*/

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeStory, LAYOUTS } from './story.mjs';

const APPLE = { w: 886, h: 1920, min: 15, max: 30 };
const GOOGLE = { w: 1080, h: 1920, autoplay: 30 };

function fail(message) {
  console.error(message);
  process.exit(1);
}

function spawn(cmd, args, quiet) {
  const options = { stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' };
  if (process.platform === 'win32' && cmd === 'npx') {
    // Node won't spawn the npx.cmd shim without a shell, and an args array plus shell:true is
    // deprecated (DEP0190), so hand the shell a single, quoted command line.
    const line = ['npx.cmd', ...args].map(a => (/[\s"&|<>^]/.test(a) ? `"${a}"` : a)).join(' ');
    return spawnSync(line, { ...options, shell: true });
  }
  return spawnSync(cmd, args, options);
}

function run(cmd, args, { quiet = false } = {}) {
  const result = spawn(cmd, args, quiet);
  if (result.error) fail(`could not run ${cmd}: ${result.error.message}`);
  if (result.status !== 0) fail(`${cmd} ${args.slice(0, 3).join(' ')} failed (exit ${result.status})${quiet ? `\n${result.stderr || result.stdout}` : ''}`);
  return result.stdout || '';
}

const probe = file => JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { quiet: true }));
const round = n => +n.toFixed(3);

// A royalty-free bed made from scratch: I–V–vi–IV pad in C, a bass pluck per beat, a soft kick
// on beats 1 and 3 and an off-beat hat, at 96 BPM. Each voice's envelope is zero wherever its
// pitch changes, so the chord switches don't click.
function synthMusic(out, seconds) {
  const k = 'mod(floor(t/2.5),4)';
  const pick = (...hz) => `(${hz.map((f, i) => `${f}*eq(${k},${i})`).join('+')})`;
  const f1 = pick(261.63, 246.94, 261.63, 261.63), f2 = pick(329.63, 293.66, 329.63, 349.23);
  const f3 = pick(392, 392, 440, 440), fb = pick(130.81, 98, 110, 87.31);
  const beat = 'mod(t,0.625)', half = 'mod(t,1.25)';
  const pad = `pow(sin(PI*mod(t,2.5)/2.5),0.6)*(sin(2*PI*${f1}*t)+sin(2*PI*${f2}*t)+0.8*sin(2*PI*${f3}*t))/2.8`;
  const bass = `exp(-${beat}*5)*(1-exp(-${beat}*300))*(1-exp(-(0.625-${beat})*200))*sin(2*PI*${fb}*${beat})`;
  const kick = `exp(-${half}*14)*sin(2*PI*(45*${half}+120/35*(1-exp(-35*${half}))))`;
  const hat = '(2*random(0)-1)*exp(-mod(t+0.3125,0.625)*70)';
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='0.22*${pad}+0.3*${bass}+0.5*${kick}+0.05*${hat}':s=48000:d=${seconds}`,
    '-af', `highpass=f=30,lowpass=f=9000,aecho=0.8:0.6:60:0.25,pan=stereo|c0=c0|c1=c0,adelay=delays=0|10,loudnorm=I=-18:TP=-2:LRA=11,afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(0, seconds - 2)}:d=2`,
    '-ar', '48000', '-c:a', 'pcm_s16le', out]);
}

function placeMusic(music, baseDir, assets, seconds) {
  if (!music) return null;
  if (music === 'synth') {
    synthMusic(path.join(assets, 'music.wav'), seconds);
    return 'assets/music.wav';
  }
  const src = path.resolve(baseDir, music);
  if (!fs.existsSync(src)) fail(`music not found: ${src}`);
  const name = `music${path.extname(src)}`;
  fs.copyFileSync(src, path.join(assets, name));
  return `assets/${name}`;
}

const audioTag = (src, seconds) => src
  ? `<audio id="music" src="${src}" data-start="0" data-duration="${seconds}" data-volume="0.8" data-fade-in="0.5" data-fade-out="1.5"></audio>`
  : '';

// Drawn as CSS shapes, not text glyphs: they are decoration, and as text they would trip the
// layout (occluded text) and contrast audits whenever a full-frame slide covers them.
const SPARKLES = [[83, 5.5, 'p'], [91, 11, 'd'], [15, 10, 's'], [6.5, 23, 'p'],
  [88, 31, 's'], [4.5, 45, 'd'], [93, 52, 'p'], [9, 67, 'd']]
  .map(([x, y, kind]) => `<span class="spark ${kind}" style="left:${x}%;top:${y}%"></span>`).join('');

function page({ id, w, h, seconds, theme, css, body, script }) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${w}, height=${h}" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: ${theme.bg}; }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; color: ${theme.text}; font-family: "Inter", system-ui, sans-serif; }
  .bg { position: absolute; inset: 0; background:
      radial-gradient(42% 26% at 13% 8%, color-mix(in srgb, ${theme.accent} 22%, transparent), transparent 62%),
      radial-gradient(40% 24% at 90% 88%, color-mix(in srgb, ${theme.accent} 15%, transparent), transparent 62%),
      linear-gradient(180deg, ${theme.bg}, ${theme.bg2}); }
  .spark { position: absolute; display: block; }
  .spark.p { width: ${Math.round(w * 0.026)}px; height: ${Math.round(w * 0.026)}px; opacity: .55; }
  .spark.p::before, .spark.p::after { content: ""; position: absolute; background: ${theme.accent}; border-radius: 2px; }
  .spark.p::before { left: 0; right: 0; top: 40%; height: 20%; }
  .spark.p::after { top: 0; bottom: 0; left: 40%; width: 20%; }
  .spark.s { width: ${Math.round(w * 0.026)}px; height: ${Math.round(w * 0.026)}px; opacity: .5; background: ${theme.accent};
             clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); }
  .spark.d { width: ${Math.round(w * 0.009)}px; height: ${Math.round(w * 0.009)}px; border-radius: 50%; background: ${theme.accent}; opacity: .4; }
  .clip { position: absolute; inset: 0; }
${css}
</style>
</head>
<body>
<div id="root" data-composition-id="${id}" data-start="0" data-duration="${seconds}" data-width="${w}" data-height="${h}">
<div class="bg"></div>
<div class="sparkles">${SPARKLES}</div>
${body}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${script}
window.__timelines["${id}"] = tl;
</script>
</body>
</html>
`;
}

function placeIcon(icon, baseDir, assets) {
  if (!icon) return null;
  const src = path.resolve(baseDir, icon);
  if (!fs.existsSync(src)) fail(`icon not found: ${src}`);
  fs.copyFileSync(src, path.join(assets, `icon${path.extname(src)}`));
  return `assets/icon${path.extname(src)}`;
}

// A still that flies into the phone (a receipt, a photo), cropped to its subject.
function placeStill(still, baseDir, assets, name) {
  const src = path.resolve(baseDir, still.src);
  if (!fs.existsSync(src)) fail(`image not found: ${src}`);
  const out = path.join(assets, `${name}.png`);
  const [x, y, w, h] = still.crop || [];
  run('ffmpeg', ['-y', '-v', 'error', '-i', src, ...(still.crop ? ['-vf', `crop=${w}:${h}:${x}:${y}`] : []), out]);
  const { width, height } = probe(out).streams[0];
  return { file: `assets/${name}.png`, ratio: height / width };
}

// Trim, drop the phone's own status and navigation bars (Apple rejects other platforms' UI),
// and re-encode at a constant 30 fps so HyperFrames extracts exact frames.
function prepClip(clip, crop, baseDir, out) {
  const src = path.resolve(baseDir, clip.src);
  if (!fs.existsSync(src)) fail(`clip not found: ${src}`);
  const from = clip.from ?? 0;
  const length = (clip.to ?? +probe(src).format.duration) - from;
  if (!(length > 0)) fail(`clip ${clip.src} has no length between from and to`);
  const cut = (crop?.top ?? 0) + (crop?.bottom ?? 0);
  // Phone recordings are variable frame rate and write no frames while the screen is still, so
  // fill the gaps at 30 fps first and trim after; trimming first drops a still opening or ending.
  run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-t', String(length),
    '-vf', `fps=30,trim=start=${from}:duration=${length},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${length},crop=iw:ih-${cut}:0:${crop?.top ?? 0},format=yuv420p`,
    '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', out]);
  const info = probe(out);
  const video = info.streams.find(s => s.codec_type === 'video');
  return { width: video.width, height: video.height, seconds: round(+info.format.duration) };
}

function buildStory(config, baseDir, dir, store) {
  const story = config.story;
  if (!story?.scenes?.length) fail('video.json needs story.scenes; see the usage at the top of video.mjs');
  const assets = path.join(dir, 'assets');
  let n = 0, aspect = null;
  const prep = shots => (shots || []).map(shot => {
    const file = `assets/shot-${++n}.mp4`;
    const info = prepClip(shot, config.crop, baseDir, path.join(dir, file));
    aspect ??= info.width / info.height;
    return { file, seconds: info.seconds };
  });
  const framed = LAYOUTS[store].frame;
  const pick = s => (store === 'apple' && s.apple_shots ? s.apple_shots : s.shots);
  const hook = { ...story.hook, shots: store === 'apple' ? prep(story.hook.apple_shots) : [] };
  if (store === 'apple' && !hook.shots.length) fail('story.hook.apple_shots is required: the App Store preview is screen captures only');
  const scenes = story.scenes.map((s, i) => {
    if (!pick(s)?.length) fail(`story.scenes[${i}] has no shots`);
    return { ...s, shots: prep(pick(s)), receipt: s.receipt && framed ? { at: s.receipt.at ?? 1, ...placeStill(s.receipt, baseDir, assets, `still-${i}`) } : null };
  });
  const icon = framed ? placeIcon(config.icon, baseDir, assets) : null;
  const { css, body, script, seconds } = composeStory({ store, theme: config.theme, name: config.name, tagline: config.tagline,
    icon, chapters: story.chapters || [], hook, scenes, outro: story.outro, aspect, currency: config.currency || '₺', style: config.style || 'bold' });
  if (store === 'apple' && (seconds < APPLE.min || seconds > APPLE.max)) fail(`App Store previews must run ${APPLE.min}–${APPLE.max} s; this story runs ${seconds} s. Adjust the shots.`);
  if (store === 'google' && seconds > GOOGLE.autoplay) console.warn(`google promo runs ${seconds} s; only the first ${GOOGLE.autoplay} s autoplay.`);
  const music = placeMusic(config.music, baseDir, assets, seconds);
  const size = LAYOUTS[store];
  fs.writeFileSync(path.join(dir, 'index.html'), page({ id: store === 'apple' ? 'preview' : 'promo', w: size.w, h: size.h, seconds, theme: config.theme,
    css, body: `${body}\n${audioTag(music, seconds)}`, script }));
}

function useBundledChrome() {
  if (process.env.HYPERFRAMES_BROWSER_PATH) return;
  // System Chrome and Edge can hang on the `--version` probe on Windows; HyperFrames' pinned build doesn't.
  const result = spawn('npx', ['-y', 'hyperframes', 'browser', 'path'], true);
  const found = (result.stdout || '').split(/\r?\n/).map(l => l.trim()).reverse().find(l => l && fs.existsSync(l));
  if (found) process.env.HYPERFRAMES_BROWSER_PATH = found;
}

function finalize(raw, out, store, fast) {
  const hasAudio = probe(raw).streams.some(s => s.codec_type === 'audio');
  const apple = store === 'apple';
  // App Store previews need a stereo audio track even when silent.
  const silence = apple && !hasAudio;
  const args = ['-y', '-v', 'error', '-i', raw, ...(silence ? ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v', '-map', '1:a', '-shortest'] : [])];
  const video = apple
    ? ['-vf', `scale=${APPLE.w}:${APPLE.h}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M']
    : ['-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', fast ? 'veryfast' : 'slow', '-crf', '18'];
  const audio = hasAudio || silence ? ['-c:a', 'aac', '-b:a', apple ? '256k' : '192k', '-ac', '2', '-ar', '48000'] : ['-an'];
  run('ffmpeg', [...args, ...video, ...audio, '-movflags', '+faststart', out]);
}

function check(out, store) {
  const info = probe(out);
  const video = info.streams.find(s => s.codec_type === 'video');
  const audio = info.streams.find(s => s.codec_type === 'audio');
  const [num, den] = video.avg_frame_rate.split('/').map(Number);
  const fps = round(num / den), seconds = round(+info.format.duration);
  const warnings = [];
  if (store === 'apple') {
    if (video.width !== APPLE.w || video.height !== APPLE.h) warnings.push(`size is ${video.width}x${video.height}, App Store wants ${APPLE.w}x${APPLE.h}`);
    if (fps > 30) warnings.push(`${fps} fps; App Store allows at most 30`);
    if (seconds < APPLE.min || seconds > APPLE.max) warnings.push(`${seconds} s; App Store wants ${APPLE.min}–${APPLE.max} s`);
    if (!audio || audio.channels !== 2) warnings.push('App Store previews need a stereo audio track');
  } else if (seconds > GOOGLE.autoplay) {
    warnings.push(`${seconds} s; Google Play autoplays only the first ${GOOGLE.autoplay} s`);
  }
  return { out, size: `${video.width}x${video.height}`, codec: video.codec_name, fps, seconds,
    audio: audio ? `${audio.codec_name} ${audio.channels}ch ${audio.sample_rate} Hz` : 'none', warnings };
}

// Store key → [output folder, file name].
const OUTPUTS = { google: ['google', 'promo'], apple: ['apple', 'preview'], 'ios-promo': ['apple', 'promo'] };

function main() {
  const argv = process.argv.slice(2);
  const fast = argv.includes('--fast');
  const onlyAt = argv.indexOf('--only');
  const only = onlyAt >= 0 ? (argv[onlyAt + 1] || '').split(',').filter(Boolean) : null;
  const arg = argv.find((a, i) => !a.startsWith('--') && (onlyAt < 0 || i !== onlyAt + 1)) ?? (argv.includes('--help') || argv.includes('-h') ? '--help' : undefined);
  if (!arg || arg === '-h' || arg === '--help') {
    const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    console.log(source.slice(source.indexOf('/*') + 3, source.indexOf('*/')).trim());
    process.exit(arg ? 0 : 1);
  }
  const configPath = path.resolve(arg);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const baseDir = path.dirname(configPath);
  const root = path.resolve(baseDir, config.out_root || '.');
  config.theme = { bg: '#15151c', bg2: '#0b0b10', accent: '#6d5efc', text: '#ffffff', ...config.theme };
  if (!config.name) fail('video.json needs a "name" for the intro and outro');
  const stores = only || config.stores || Object.keys(OUTPUTS);
  const unknown = stores.filter(s => !OUTPUTS[s]);
  if (unknown.length) fail(`unknown store ${unknown.join(', ')}; use ${Object.keys(OUTPUTS).join(', ')}`);
  const sfx = config.suffix ? `-${config.suffix}` : '';

  useBundledChrome();
  const results = [];
  for (const store of stores) {
    const dir = path.join(root, 'store', '.video', store + sfx);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ id: `${store}-video`, name: `${config.name} ${store} video` }, null, 2));
    buildStory(config, baseDir, dir, store);

    if (!fast) run('npx', ['-y', 'hyperframes', 'check', dir]);
    const raw = path.join(dir, 'renders', 'raw.mp4');
    run('npx', ['-y', 'hyperframes', 'render', dir, '-o', raw, '--fps', '30', '--quality', fast ? 'draft' : 'delivery', '--quiet']);

    const [folder, file] = OUTPUTS[store];
    const outDir = path.join(root, 'store', folder, 'video');
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${file}${sfx}.mp4`);
    finalize(raw, out, store, fast);
    // One ~90 px frame per second, ten to a row: enough to judge the film at a glance for a
    // fraction of what full-size frames cost to look at.
    run('ffmpeg', ['-y', '-v', 'error', '-i', out, '-vf', 'fps=1,scale=90:-2,tile=10x3', '-frames:v', '1', path.join(dir, 'review.png')]);
    results.push({ store, ...check(out, store) });
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
