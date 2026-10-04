/*
Compose a store video from a storyboard: a hook, chapters of real screen recordings playing in one
persistent phone under a chapter rail and captions, an optional trust beat, and an outro card.

The same story renders for both stores. Google gets the full film (hook card, device frame, the
phone's entrance, receipt-style overlays, outro card). Apple gets screen captures only: the hook
and every caption sit over footage, with no device frame, overlay art or title cards.

Returns { css, body, script, seconds } for video.mjs to wrap in a page. Every time below is in
seconds on the root timeline; nothing reads the clock, so renders stay deterministic.
*/

import { getStyle } from './styles.mjs';

const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const round = n => +n.toFixed(3);
// `*word*` takes the accent2 emphasis and `\n` breaks the line, like the store image headlines.
const rich = text => esc(text || '').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
// Hook lines animate word by word, so each word is its own span; emphasis survives per word.
function words(text) {
  let inEm = false;
  return (text || '').split('\n').map(line => line.split(' ').filter(Boolean).map(word => {
    const opens = word.startsWith('*'), closes = /\*[.,!?]*$/.test(word);
    const em = inEm || opens;
    inEm = (inEm || opens) && !closes;
    return `<span class="w${em ? ' em' : ''}">${esc(word.replace(/\*/g, ''))}</span>`;
  }).join(' ')).join('<br>');
}

export const LAYOUTS = {
  google: { w: 1080, h: 1920, railY: 74, railX: 80, railLabel: 24, capTop: 150, capH: 240, capSize: 68,
    screenH: 1330, screenTop: 418, bezel: 16, radius: 62, frame: true, hookSize: 112, receipt: [60, 640, 470] },
  // The Google film at iPhone size, for the web, social and ads (not an App Store app preview).
  'ios-promo': { w: 886, h: 1920, railY: 60, railX: 44, railLabel: 20, capTop: 120, capH: 220, capSize: 58,
    screenH: 1300, screenTop: 382, bezel: 15, radius: 58, frame: true, hookSize: 94, receipt: [34, 620, 400] },
  apple: { w: 886, h: 1920, railY: 54, railX: 40, railLabel: 20, capTop: 96, capH: 196, capSize: 50,
    screenH: 1610, screenTop: 304, bezel: 0, radius: 40, frame: false },
};

/*
scenes: [{ chapter, caption, shots: [{ file, seconds }],
           receipt: { file, ratio, at }, coins | burst: { at, y, count, glyphs }, trust: bool }]
hook:   { lines: [...], seconds, shots? }   shots only for Apple, where the hook plays over footage
*/
export function composeStory({ store, theme, name, tagline, icon, chapters, hook, scenes, outro, aspect, currency = '₺', style = 'bold' }) {
  const L = LAYOUTS[store];
  const S = getStyle(style);
  const accent2 = theme.accent2 || theme.accent;
  const screenW = Math.round(L.screenH * aspect);
  const deviceW = screenW + 2 * L.bezel, deviceH = L.screenH + 2 * L.bezel;
  const deviceLeft = Math.round((L.w - deviceW) / 2);
  const body = [], script = [], videos = [];
  // Several tweens drive #bump; without a baseline the last one authored would set its resting
  // state for every frame before the first of them runs.
  script.push('tl.set("#bump", { scale: 1, x: 0, opacity: 1, filter: "blur(0px)" }, 0);');
  let t = 0;

  // Hook. Google: big words on the brand background. Apple: captions over the first footage.
  const hookEnd = hook.seconds;
  if (L.frame) {
    body.push(`<div id="hook" class="clip hook" data-start="0" data-duration="${hookEnd}">` +
      hook.lines.map((line, i) => `<div class="hook-line" id="hook${i}">${words(line)}</div>`).join('') + '</div>');
    const slot = hookEnd / hook.lines.length;
    hook.lines.forEach((_, i) => {
      const at = round(i * slot + 0.12);
      script.push(S.hookIn(`#hook${i}`, at));
      const out = i < hook.lines.length - 1 ? round((i + 1) * slot - 0.22) : round(hookEnd - 0.3);
      script.push(`tl.to("#hook${i}", { opacity: 0, y: -50, scale: 0.96, duration: 0.25, ease: "power2.in" }, ${out});`);
    });
  } else {
    const slot = hookEnd / hook.lines.length;
    hook.lines.forEach((line, i) => body.push(captionClip(`hk${i}`, round(i * slot), round(slot), line)));
    hook.lines.forEach((_, i) => script.push(...captionMotion(S, `hk${i}`, round(i * slot), round(slot))));
    for (const shot of hook.shots || []) { videos.push({ ...shot, start: round(t) }); t += shot.seconds; }
  }
  t = hookEnd;

  // Chapters, trust and the rail that tracks them.
  const sceneTimes = [];
  for (const scene of scenes) {
    const start = round(t);
    for (const shot of scene.shots) { videos.push({ ...shot, start: round(t) }); t += shot.seconds; }
    sceneTimes.push({ start, end: round(t) });
  }
  const contentEnd = round(t);
  const firstTrust = scenes.findIndex(s => s.trust);
  const railStart = hookEnd, railEnd = firstTrust < 0 ? contentEnd : sceneTimes[firstTrust].start;

  body.push(`<div id="rail" class="clip rail" data-start="${railStart}" data-duration="${round(railEnd - railStart + 0.35)}"><div class="rail-in" id="rail-in">` +
    chapters.map((c, i) => `<div class="seg"><span class="lab" id="lab${i}">${esc(c)}</span><span class="bar"><i id="fill${i}"></i></span></div>`).join('') + '</div></div>');
  script.push(`tl.fromTo("#rail-in", { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, ${railStart});`,
    `tl.to("#rail-in", { opacity: 0, y: -24, duration: 0.3, ease: "power2.in" }, ${railEnd});`);
  chapters.forEach((_, c) => {
    const own = scenes.map((s, i) => (s.chapter === c && !s.trust ? sceneTimes[i] : null)).filter(Boolean);
    if (!own.length) return;
    const from = own[0].start, to = own[own.length - 1].end;
    script.push(`tl.to("#lab${c}", { opacity: 1, duration: 0.25 }, ${from});`,
      `tl.fromTo("#fill${c}", { scaleX: 0 }, { scaleX: 1, duration: ${round(to - from)}, ease: "none" }, ${from});`,
      `tl.to("#lab${c}", { opacity: 0.72, duration: 0.25 }, ${to});`);
  });

  scenes.forEach((scene, i) => {
    const { start, end } = sceneTimes[i];
    body.push(captionClip(`cap${i}`, start, round(end - start), scene.caption));
    script.push(...captionMotion(S, `cap${i}`, start, round(end - start)));
    // Every chapter change gets the look's transition, so the one phone still reads as a cut.
    if (i > 0 && !scene.trust) script.push(...S.cut(start, L.frame));
    if (scene.receipt && L.frame) {
      const at = round(start + scene.receipt.at), id = `rc${i}`;
      body.push(`<div id="${id}" class="clip rc" data-start="${at}" data-duration="1.7"><div class="rc-in" id="${id}-in"><img src="${scene.receipt.file}" alt=""><i class="scan" id="${id}-scan"></i></div></div>`);
      script.push(`tl.fromTo("#${id}-in", { x: -560, rotation: -18, opacity: 0 }, { x: 0, rotation: -7, opacity: 1, duration: 0.5, ease: "back.out(1.4)" }, ${at});`,
        `tl.fromTo("#${id}-scan", { y: 0, opacity: 0 }, { y: ${Math.round((L.receipt?.[2] ?? 0) * scene.receipt.ratio)}, opacity: 1, duration: 0.65, ease: "power1.inOut" }, ${round(at + 0.42)});`,
        `tl.to("#${id}-in", { x: 300, y: -170, scale: 0.22, rotation: 0, opacity: 0, duration: 0.42, ease: "power2.in" }, ${round(at + 1.15)});`);
    }
    // `coins` sends money (coins and notes in the currency symbol); `burst` sends whatever the
    // screen is about — `glyphs` such as ["❤️", "⭐"] on rounded chips — with the same flight.
    const flight = scene.coins || scene.burst;
    if (flight && L.frame) {
      // Money flies in from around the frame and lands on the screen at height y, then the phone
      // gives a small kick as it arrives. Start points follow the golden angle, so they are spread
      // evenly and the same on every render.
      const c = flight, glyphs = scene.coins ? null : (c.glyphs?.length ? c.glyphs : ['✦']), at = round(start + (c.at ?? 0.2)), id = `cn${i}`;
      const tx = deviceLeft + L.bezel + screenW / 2, ty = L.screenTop + (c.y ?? 0.3) * L.screenH;
      const items = Array.from({ length: c.count ?? 8 }, (_, k) => {
        const a = (k * 137.5 + 20) * Math.PI / 180, r = L.w * (0.4 + 0.07 * (k % 3));
        return { k, kind: glyphs ? 'chip' : (k % 3 === 0 ? 'note' : 'coin'), glyph: glyphs ? glyphs[k % glyphs.length] : currency, dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 1.2), rot: (k % 2 ? 1 : -1) * (30 + 12 * (k % 4)) };
      });
      body.push(`<div id="${id}" class="clip coins" data-layout-allow-overlap="true" data-start="${at}" data-duration="1.8">` + items.map(m =>
        `<span class="${m.kind}" id="${id}-${m.k}" style="left:${Math.round(tx)}px;top:${Math.round(ty)}px">${esc(m.glyph)}</span>`).join('') + '</div>');
      items.forEach(m => script.push(`tl.fromTo("#${id}-${m.k}", { x: ${m.dx}, y: ${m.dy}, rotation: ${m.rot}, scale: 0.6, opacity: 0 }, { scale: 1.25, opacity: 1, duration: 0.22, ease: "back.out(2)" }, ${round(at + m.k * 0.07)});`,
        `tl.to("#${id}-${m.k}", { x: 0, y: 0, rotation: 0, scale: 0.3, duration: 0.62, ease: "power1.in" }, ${round(at + m.k * 0.07 + 0.22)});`,
        `tl.to("#${id}-${m.k}", { opacity: 0, duration: 0.08 }, ${round(at + m.k * 0.07 + 0.84)});`));
      script.push(`tl.fromTo("#bump", { scale: 1.035 }, { scale: 1, duration: 0.35, ease: "power2.out" }, ${round(at + 0.84 + (items.length - 1) * 0.07)});`);
    }
    if (scene.trust && L.frame) script.push(`tl.to("#device", { scale: 0.72, y: 70, duration: 0.7, ease: "power3.inOut" }, ${start});`);
  });

  // The one phone: entrance, screen, and every shot inside it.
  const vid = videos.map((v, k) => `<video id="v${k + 1}" class="shot" src="${v.file}" data-start="${v.start}" data-duration="${v.seconds}" muted playsinline></video>`).join('');
  body.push(`<div id="device" class="device" style="left:${deviceLeft}px;top:${L.screenTop - L.bezel}px;width:${deviceW}px;height:${deviceH}px">` +
    `<div id="bump" class="fill"><div class="screen">${vid}</div></div></div>`);
  if (L.frame) {
    script.push(S.deviceIn(hookEnd), ...S.idle(round(hookEnd + 1.5), contentEnd));
    if (S.backdrop) body.unshift(S.backdrop());
    body.push(S.overlays());
  } else {
    script.push(`tl.fromTo("#device", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0);`);
  }

  // Outro (Google only): the phone drops away and the brand card lands.
  let seconds = contentEnd;
  if (L.frame && outro) {
    seconds = round(contentEnd + outro.seconds);
    // Leaves while its last shot is still playing, so the screen never goes black on the way out.
    script.push(`tl.to("#device", { opacity: 0, y: 380, scale: 0.42, duration: 0.45, ease: "power2.in" }, ${round(contentEnd - 0.45)});`);
    body.push(`<div id="outro" class="clip card" data-start="${contentEnd}" data-duration="${outro.seconds}"><div class="card-inner">` +
      (icon ? `<img class="icon" id="o-icon" src="${icon}" alt="">` : '') +
      `<div class="name" id="o-name">${esc(name)}</div><div class="tag" id="o-tag">${esc(tagline || '')}</div>` +
      (outro.cta ? `<div class="cta" id="o-cta">${esc(outro.cta)}</div>` : '') + '</div></div>');
    const at = round(contentEnd);
    script.push(`tl.fromTo("#o-icon", { opacity: 0, scale: 0.5, rotation: -12 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.65, ease: "back.out(1.8)" }, ${at});`,
      `tl.fromTo("#o-name", { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${round(at + 0.2)});`,
      `tl.fromTo("#o-tag", { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, ${round(at + 0.42)});`,
      `tl.fromTo("#o-cta", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, ${round(at + 0.8)});`);
  }

  const segW = Math.floor((L.w - 2 * L.railX - (chapters.length - 1) * 16) / chapters.length);
  // Many chapters make narrow segments: shrink the labels until the longest one fits its segment.
  const longest = Math.max(1, ...chapters.map(c => [...c].length));
  const railLabel = Math.min(L.railLabel, Math.floor(segW / (longest * 0.8)));
  const css = `  .fill { position: absolute; inset: 0; }
  .hook { display: flex; align-items: center; justify-content: center; }
  .hook-line { position: absolute; width: 100%; padding: 0 ${Math.round(L.w * 0.06)}px; text-align: center; font-size: ${L.hookSize}px; font-weight: 800; line-height: 1.04; letter-spacing: -0.035em; }
  .w { display: inline-block; }
  .w.em { color: ${accent2}; }
  .rail { bottom: auto; height: ${L.railY + 40}px; }
  .rail-in { position: absolute; left: ${L.railX}px; right: ${L.railX}px; top: ${L.railY}px; display: flex; gap: 16px; }
  .seg { width: ${segW}px; display: flex; flex-direction: column; gap: 10px; }
  .lab { font-size: ${railLabel}px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; opacity: .36; }
  .bar { position: relative; display: block; height: 6px; border-radius: 99px; background: rgba(255,255,255,.14); overflow: hidden; }
  .bar i { position: absolute; inset: 0; background: ${theme.accent}; transform-origin: 0 50%; transform: scaleX(0); border-radius: 99px; }
  .cap { bottom: auto; top: ${L.capTop}px; height: ${L.capH}px; display: flex; align-items: center; justify-content: center; z-index: 5; }
  .cap-text { width: 100%; padding: 0 56px; text-align: center; font-size: ${L.capSize}px; font-weight: 800; line-height: 1.08; letter-spacing: -0.025em; text-shadow: 0 6px 30px rgba(0,0,0,.45); }
  .cap-text em { font-style: normal; color: ${accent2}; }
  .device { position: absolute; opacity: 0; ${L.frame ? `border-radius: ${L.radius + L.bezel}px; background: #050608;
            box-shadow: 0 0 0 3px #2a2d33, 0 50px 110px rgba(0,0,0,.6), 0 0 180px color-mix(in srgb, ${theme.accent} 24%, transparent);` : ''} }
  .screen { position: absolute; inset: ${L.bezel}px; border-radius: ${L.radius}px; overflow: hidden; background: #000; }
  .shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .rc { z-index: 6; }
  .rc-in { position: absolute; left: ${L.receipt?.[0]}px; top: ${L.receipt?.[1]}px; width: ${L.receipt?.[2]}px; border-radius: 10px; overflow: hidden; box-shadow: 0 40px 90px rgba(0,0,0,.55); }
  .rc-in img { display: block; width: 100%; }
  .scan { position: absolute; left: 0; right: 0; top: 0; height: 8px; background: ${theme.accent}; box-shadow: 0 0 30px 8px color-mix(in srgb, ${theme.accent} 70%, transparent); }
  .coins { z-index: 7; }
  .coin, .note, .chip { position: absolute; display: flex; align-items: center; justify-content: center; font-weight: 800; }
  .coin { width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; font-size: 60px; color: #6b4200;
          background: radial-gradient(circle at 35% 30%, #fff2b8, #f8c43a 45%, #c98a00); box-shadow: inset 0 -6px 0 rgba(0,0,0,.18), 0 14px 30px rgba(0,0,0,.4); }
  .note { width: 220px; height: 114px; margin: -57px 0 0 -110px; border-radius: 14px; font-size: 58px; color: #0b3d20;
          background: linear-gradient(135deg, #7ef0a8, ${theme.accent} 55%, #128a43); border: 4px solid rgba(255,255,255,.35); box-shadow: 0 16px 34px rgba(0,0,0,.4); }
  .chip { width: 124px; height: 124px; margin: -62px 0 0 -62px; border-radius: 34px; font-size: 66px; color: ${theme.text};
          background: color-mix(in srgb, ${theme.accent} 30%, ${theme.bg2}); border: 3px solid color-mix(in srgb, ${theme.accent} 70%, transparent); box-shadow: 0 16px 34px rgba(0,0,0,.4); }
  .card { display: flex; align-items: center; justify-content: center; }
  .card-inner { width: 100%; padding: 0 90px; text-align: center; }
  .icon { display: block; margin: 0 auto 56px; width: 260px; height: 260px; border-radius: 22%; box-shadow: 0 30px 70px rgba(0,0,0,.5); }
  .name { font-size: 128px; font-weight: 800; letter-spacing: -0.03em; }
  .tag { margin-top: 22px; font-size: 48px; font-weight: 500; opacity: .85; }
  .cta { display: inline-block; margin-top: 64px; padding: 26px 64px; border-radius: 99px; background: ${theme.accent}; color: #06140b; font-size: 44px; font-weight: 800; }`;

  return { css: css + '\n' + S.css(theme), body: body.join('\n'), script: script.join('\n'), seconds };
}

function captionClip(id, start, seconds, text) {
  return `<div id="${id}" class="clip cap" data-start="${start}" data-duration="${seconds}"><div class="cap-text" id="${id}-t">${rich(text)}</div></div>`;
}

function captionMotion(S, id, start, seconds) {
  return [S.captionIn(`#${id}-t`, round(start + 0.06)), S.captionOut(`#${id}-t`, round(start + seconds - 0.26))];
}
