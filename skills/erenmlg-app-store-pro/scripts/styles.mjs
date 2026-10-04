/*
The five looks a store film can take. A look decides how the hook's words arrive, how captions
come and go, how the phone enters, what a chapter change does, and what sits behind the phone.
story.mjs calls these at fixed times on one paused GSAP timeline, so every look stays
deterministic: no randomness, no endless repeats.

Recipes follow the HyperFrames transition catalog (hyperframes-animation/transitions): zoom and
scale, blur through, light leak, glitch and chromatic split, elastic and bounce eases.

`frame` is false for the App Store app preview, which may only show screen captures: there a
look keeps its type and caption motion but drops every overlay layer (glitch bars, light leaks).
*/

const r = n => +n.toFixed(3);

const BOLD = {
  label: 'Bold kinetic',
  hookIn: (sel, at) => `tl.fromTo("${sel} .w", { opacity: 0, y: 70, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(1.6)", stagger: 0.09 }, ${at});`,
  captionIn: (sel, at) => `tl.fromTo("${sel}", { opacity: 0, y: 38 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${at});`,
  captionOut: (sel, at) => `tl.to("${sel}", { opacity: 0, y: -26, duration: 0.24, ease: "power1.in" }, ${at});`,
  deviceIn: at => `tl.fromTo("#device", { opacity: 0, y: 520, rotationX: 26, rotationY: -16, scale: 0.84 }, { opacity: 1, y: 0, rotationX: 0, rotationY: 0, scale: 1, duration: 0.95, ease: "power3.out", transformPerspective: 1600 }, ${at});`,
  cut: at => [`tl.fromTo("#bump", { scale: 0.955 }, { scale: 1, duration: 0.42, ease: "power2.out", immediateRender: false }, ${at});`],
  css: () => '',
  overlays: () => '',
  idle: () => [],
};

const MINIMAL = {
  label: 'Minimal clean',
  hookIn: (sel, at) => `tl.fromTo("${sel} .w", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.05 }, ${at});`,
  captionIn: (sel, at) => `tl.fromTo("${sel}", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "sine.out" }, ${at});`,
  captionOut: (sel, at) => `tl.to("${sel}", { opacity: 0, duration: 0.3, ease: "sine.in" }, ${at});`,
  deviceIn: at => `tl.fromTo("#device", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, ${at});`,
  // A soft dip instead of a kick: the screen breathes out and back in.
  cut: at => [`tl.fromTo("#bump", { opacity: 0.35 }, { opacity: 1, duration: 0.35, ease: "sine.out", immediateRender: false }, ${at});`],
  css: theme => `  .bg { background: linear-gradient(180deg, ${theme.bg}, ${theme.bg2}); }
  .sparkles { display: none; }
  .cap-text { font-weight: 700; letter-spacing: -0.01em; text-shadow: none; }
  .hook-line { font-weight: 700; letter-spacing: -0.02em; }`,
  overlays: () => '',
  idle: () => [],
};

const NEON = {
  label: 'Neon tech',
  hookIn: (sel, at) => `tl.fromTo("${sel} .w", { opacity: 0, x: -14, skewX: 22 }, { opacity: 1, x: 0, skewX: 0, duration: 0.2, ease: "steps(3)", stagger: 0.07 }, ${at});`,
  captionIn: (sel, at) => `tl.fromTo("${sel}", { opacity: 0, x: -30, skewX: 14 }, { opacity: 1, x: 0, skewX: 0, duration: 0.24, ease: "steps(4)" }, ${at});`,
  captionOut: (sel, at) => `tl.to("${sel}", { opacity: 0, x: 30, duration: 0.16, ease: "steps(3)" }, ${at});`,
  deviceIn: at => `tl.fromTo("#device", { opacity: 0, scale: 1.25, filter: "brightness(3)" }, { opacity: 1, scale: 1, filter: "brightness(1)", duration: 0.5, ease: "power3.out" }, ${at});`,
  // Glitch: RGB bars jump with the phone for four frames, then everything snaps back.
  cut: (at, frame) => {
    const jumps = [[40, -30, -18], [-30, 25, 14], [18, -12, -6]];
    const lines = jumps.map(([red, cyan, phone], k) => {
      const t = r(at + k * 0.05);
      return (frame ? `tl.set("#fx-red", { opacity: 0.35, x: ${red} }, ${t}); tl.set("#fx-cyan", { opacity: 0.35, x: ${cyan} }, ${t}); ` : '') +
        `tl.set("#bump", { x: ${phone} }, ${t});`;
    });
    const end = r(at + 0.15);
    lines.push((frame ? `tl.set(["#fx-red", "#fx-cyan"], { opacity: 0, x: 0 }, ${end}); ` : '') + `tl.set("#bump", { x: 0 }, ${end});`);
    return lines;
  },
  css: theme => `  .bg { background:
      repeating-linear-gradient(0deg, color-mix(in srgb, ${theme.accent} 9%, transparent) 0 2px, transparent 2px 90px),
      repeating-linear-gradient(90deg, color-mix(in srgb, ${theme.accent} 9%, transparent) 0 2px, transparent 2px 90px),
      radial-gradient(60% 40% at 50% 55%, color-mix(in srgb, ${theme.accent} 26%, transparent), transparent 70%),
      linear-gradient(180deg, #05060c, ${theme.bg2}); }
  .cap-text, .hook-line { text-shadow: 0 0 24px color-mix(in srgb, ${theme.accent} 70%, transparent); }
  .fx { position: absolute; inset: 0; opacity: 0; pointer-events: none; z-index: 9; }
  #fx-red { background: rgba(255, 40, 90, .35); }
  #fx-cyan { background: rgba(0, 230, 255, .35); }`,
  overlays: () => '<div id="fx-red" class="fx"></div><div id="fx-cyan" class="fx"></div>',
  idle: () => [],
};

const PLAYFUL = {
  label: 'Playful pop',
  hookIn: (sel, at) => `tl.fromTo("${sel} .w", { opacity: 0, scale: 0, rotation: -18 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: "elastic.out(1, 0.5)", stagger: 0.08 }, ${at});`,
  captionIn: (sel, at) => `tl.fromTo("${sel}", { opacity: 0, scale: 0.6, rotation: -4 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: "back.out(2.5)" }, ${at});`,
  captionOut: (sel, at) => `tl.to("${sel}", { opacity: 0, scale: 0.8, duration: 0.2, ease: "power1.in" }, ${at});`,
  deviceIn: at => `tl.fromTo("#device", { opacity: 0, y: -1100, rotation: -8 }, { opacity: 1, y: 0, rotation: 0, duration: 1, ease: "bounce.out" }, ${at});`,
  // Squash and stretch, settling on a spring.
  cut: at => [`tl.fromTo("#bump", { scaleX: 1.07, scaleY: 0.93 }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "elastic.out(1, 0.4)", immediateRender: false }, ${at});`],
  css: theme => `  .blob { position: absolute; width: 760px; height: 760px; border-radius: 50%; filter: blur(70px); opacity: .32; }
  #blob-a { left: -260px; top: 240px; background: ${theme.accent}; }
  #blob-b { right: -300px; top: 1100px; background: ${theme.accent2 || theme.accent}; }
  .cap-text { font-weight: 900; }`,
  overlays: () => '',
  // Two soft colour blobs drift for the whole film, behind everything.
  idle: (start, end) => [`tl.fromTo("#blob-a", { x: 0, y: 0 }, { x: 220, y: -160, duration: ${r(end - start)}, ease: "sine.inOut" }, ${start});`,
    `tl.fromTo("#blob-b", { x: 0, y: 0 }, { x: -200, y: 140, duration: ${r(end - start)}, ease: "sine.inOut" }, ${start});`],
  backdrop: () => '<div id="blob-a" class="blob"></div><div id="blob-b" class="blob"></div>',
};

const CINEMATIC = {
  label: 'Cinematic 3D',
  hookIn: (sel, at) => `tl.fromTo("${sel} .w", { opacity: 0, filter: "blur(14px)", y: 10 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.8, ease: "power2.out", stagger: 0.12 }, ${at});`,
  captionIn: (sel, at) => `tl.fromTo("${sel}", { opacity: 0, filter: "blur(10px)", y: 12 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.7, ease: "power2.out" }, ${at});`,
  captionOut: (sel, at) => `tl.to("${sel}", { opacity: 0, filter: "blur(8px)", duration: 0.3, ease: "power1.in" }, ${at});`,
  deviceIn: at => `tl.fromTo("#device", { opacity: 0, rotationY: -38, rotationX: 12, scale: 0.8 }, { opacity: 1, rotationY: 0, rotationX: 0, scale: 1, duration: 1.4, ease: "power3.out", transformPerspective: 1600 }, ${at});`,
  // A warm light leak sweeps across while the screen blurs through.
  cut: (at, frame) => [
    ...(frame ? [`tl.fromTo("#fx-leak", { opacity: 0, x: -500 }, { opacity: 0.6, x: 0, duration: 0.3, ease: "sine.in", immediateRender: false }, ${r(at - 0.2)});`,
      `tl.to("#fx-leak", { opacity: 0, x: 400, duration: 0.5, ease: "sine.out" }, ${r(at + 0.1)});`] : []),
    `tl.fromTo("#bump", { filter: "blur(8px)" }, { filter: "blur(0px)", duration: 0.45, ease: "power2.out", immediateRender: false }, ${at});`],
  css: theme => `  .bg::after { content: ""; position: absolute; inset: 0; background: radial-gradient(70% 55% at 50% 50%, transparent 55%, rgba(0,0,0,.55)); }
  #fx-leak { position: absolute; left: -40%; top: -10%; width: 180%; height: 120%; opacity: 0; z-index: 9; pointer-events: none;
             background: radial-gradient(35% 30% at 40% 45%, rgba(255, 196, 120, .9), rgba(255, 120, 60, .35) 50%, transparent 72%); mix-blend-mode: screen; }
  .cap-text { letter-spacing: -0.01em; }`,
  overlays: () => '<div id="fx-leak"></div>',
  // After it lands, the phone keeps turning a few degrees, like a slow dolly.
  idle: (start, end) => [`tl.to("#device", { rotationY: 7, rotationX: -2, duration: ${r(end - start)}, ease: "sine.inOut", transformPerspective: 1600 }, ${start});`],
};

export const STYLES = { bold: BOLD, minimal: MINIMAL, neon: NEON, playful: PLAYFUL, cinematic: CINEMATIC };

export function getStyle(name = 'bold') {
  const style = STYLES[name];
  if (!style) throw new Error(`unknown style "${name}"; use ${Object.keys(STYLES).join(', ')}`);
  return style;
}
