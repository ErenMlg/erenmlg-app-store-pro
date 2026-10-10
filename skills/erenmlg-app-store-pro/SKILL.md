---
name: erenmlg-app-store-pro
description: Turn raw mobile app screenshots into premium App Store and Google Play marketing images with a device frame, a themed background, and a short headline, keeping the original UI pixel-exact. Adds tilt presets, floating callout pills, a dual light/dark layout (two phones in one image), and one-command output for every App Store and Google Play size. Also writes the store listing text by reading the project — App Store name, subtitle, promotional text, description, keywords, category and age rating answers; Google Play name, short and full description — as Markdown and plain text — and makes store videos with HyperFrames — it records the app itself by driving the phone over adb, cuts a storyboarded film in one of five motion styles (bold, minimal, neon, playful, cinematic, or one the user describes) with effects that follow what is on screen (money or other tokens flying into the phone, a scanned receipt flying in), and delivers a Google Play promo, an App Store app preview and an iPhone-size promo, in English unless the user asks for another language. On a first run it analyzes the project, writes the store documents, asks for a video style, shows the screenshot and video plan for approval, then asks whether to use a connected phone or an emulator before producing anything. Use when the user shares iOS or Android screenshots and asks for store listing images, framed device mockups, launch or Product Hunt visuals, angled/3D phone mockups, side-by-side light-and-dark shots, a consistent multi-screen set, store listing text such as an app description, keywords, ASO copy, or age rating answers, or a store promo video or app preview.
license: MIT
---

# erenmlg-app-store-pro

Premium store screenshots. Based on the app-store-screenshot skill by Zafer Ayan (MIT); adds per-target sizes with automatic iPhone/Android frames, `rotation` presets, floating callouts, sparkle decoration, and a `dual` two-phone light/dark layout.

## Core Rule

Preserve the original app UI exactly. Do not redraw, restyle, translate, rewrite, hallucinate, or "improve" content inside the screenshot. Treat the screenshot as source artwork and design around it.

Never pass the screenshot through an image-generation model and present the result as the app's UI: models change text, numbers, and icons in ways that are easy to miss. Composite instead. Everything here renders the screenshot as a plain image layer that is resized and nothing else.

## Workflow

On a first run, go in this order. Do not ask anything before step 3, and do not render or record anything before the plan is approved in step 5.

1. **Analyze the project — no questions yet.** Read the README, the manifest (`pubspec.yaml`, `package.json`, `build.gradle`, `Info.plist`), the app name that ships, the UI languages it has (English decides the video language — see **Language** under **Store videos**), its screens and main flow, what needs an account or a backend, whether a fresh install seeds example data, and how it builds. Look for raw screenshots in the folder the user names, else `raw/`; note platform, brand colours and what each screen shows. Check pixel size: below ~1000 px wide a shot would be upscaled and look soft. Find the app icon at its largest: the iOS `AppIcon.appiconset` 1024 px file, the `flutter_launcher_icons` source, or Android's `ic_launcher-playstore.png` (512 px) — not a 192 px mipmap. Check which devices the app runs on: iOS `TARGETED_DEVICE_FAMILY` in `project.pbxproj` (`1,2` = iPhone and iPad) or `UIDeviceFamily` in `Info.plist`; on Android a `supports-screens` or `requiresSmallestWidthDp` limit in the manifest, and whether the layout adapts to wide screens.
2. **Write the store documents.** The listing text for both stores, in English unless the user names another language, together with the identifiers the consoles ask for first: the Google Play package name and the App Store App ID registration — description, explicit bundle ID, and which Capabilities, App Services and Capability Requests to tick, each with the evidence from the project. See **Store listing text** and `references/listing-guide.md` → **Identifiers and the App ID registration**. Validate with `scripts/listing.mjs`. Then the privacy policy page — see **Privacy policy page**. Show the user where everything is.
3. **Ask once, in one message:**
   - **Video style** — offer these five as a numbered list with their one-line description, plus a sixth line: "or describe your own":
     1. **Bold kinetic** — big words that pop, a 3D phone fly-in, punchy kicks between chapters.
     2. **Minimal clean** — calm fades, flat background, soft dips; lets the UI speak.
     3. **Neon tech** — dark grid, glowing type, glitch cuts with RGB split.
     4. **Playful pop** — elastic type, a phone that drops and bounces, squash-and-stretch cuts, drifting colour blobs.
     5. **Cinematic 3D** — blur-in type, a slow 3D dolly on the phone, light-leak transitions, vignette.
     A described style maps to the closest preset plus config changes, or to a custom look in `scripts/styles.mjs` when no preset is close. The presets and how to extend them are in `references/store-videos.md` → **Styles**. Use a multiple-choice tool only if it shows all six choices; otherwise ask as a plain numbered list.
   - **Devices** — which store sizes to render, as a numbered list the user can pick several from, with the step-1 findings pre-selected:
     1. iPhone (`apple/iphone`)
     2. iPad (`apple/ipad`) — **required** when the app runs on iPad: App Store Connect will not submit an iPad-capable build without iPad screenshots.
     3. Android phone (`google/phone`)
     4. Android 7" and 10" tablets (`google/tablet7`, `google/tablet10`) — optional, but Play shows the app to tablet users and features it on tablets only with tablet screenshots.
     5. Chromebook (`google/desktop`) and Android XR (`google/xr`) — only when the app targets them.
     Say which ones the project calls for and why. Default: iPhone + Android phone, plus iPad when the app supports it. Ask this even when the user only mentioned phones.
   - **Images:** rotation (default a light tilt), background (default gradient + sparkles; see **Backgrounds**).
   - **Videos:** yes or no (default yes when a phone or simulator can be used).
4. **Show the plan and get it approved.** One page, published as an Artifact when the tool is available (a plain Markdown summary otherwise): the chosen device targets, every screenshot with its headline, sub, eyebrow, callouts and presentation; the video storyboard — scene by scene: what is on screen, the caption, the effect that follows the action, the chapter transition of the chosen style, seconds per scene — and the three video files it will produce. Use the raw screenshots as the scene thumbnails. Change it until the user approves.
5. **Choose the device, then produce.** On approval, list what can run the app — connected phones (`adb devices -l`), Android emulators (`emulator -list-avds`), and on macOS iOS simulators (`xcrun simctl list devices available`) — and ask which to use. Boot an emulator only if the user picks one (note its serial, and close it at the end only if you started it). An emulator needs an x86_64 build (`-Ptarget-platform=android-x64`) and has no real camera or Google account; say so when the storyboard needs either.
6. **Produce the images** with `scripts/render.mjs` (see **Rendering**). If raw screenshots are missing or stale, capture them from the chosen device (`scripts/adbui.sh shot`) in the theme and language of the plan. Set `out_root` to the app's project folder; write the config into the user's working directory, never into the skill folder.
7. **Produce the videos** — record on the chosen device, cut, render with `--only google --fast` until it is right, then once for every store. See **Store videos** and `references/store-videos.md`.
8. **Review and deliver.** Run the checklist on every image and film, fix and re-render until it passes, then tell the user where everything is and what state the device and any backend were left in.

On later runs, skip whatever already exists and still matches the app (approved listing, approved plan, recordings) and say what you reused.

## Rendering

Each image is an HTML page screenshotted by headless Chrome. Script paths are relative to this skill's directory.

```bash
cp <skill-dir>/assets/set.example.json ./set.json    # then edit it
node <skill-dir>/scripts/render.mjs ./set.json
```

The script prints JSON per image: `screen_box`, `screenshot_scale`, `headline_px`, `mode`, and `warnings`. Config paths may be absolute, start with `~`, or be relative to the config file.

Requirements: Node 18+ and a Chromium-based browser (Chrome, Chromium, Edge, or Brave; set `CHROME_PATH` if not found). No packages to install. If no browser is available, say so and ask the user to install one; do not fall back to a model. Output is an opaque RGB PNG, which both stores require.

**If you get "browser produced no screenshot":** some Chromium builds can't write the PNG (seen with Brave on Windows — it fails with "Access denied"). Point `CHROME_PATH` at Chrome or Edge instead, e.g. `CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"`.

### Config reference

Top level: `targets` (which store sizes to render — default `["apple/iphone", "google/phone"]`; see **Targets**), `out_root` (where the `store/` tree is written — default beside the config; point it at the app's project folder), optional `template`, `theme`, `images`, `icon`, `feature_graphic` (see **App icon and feature graphic**).

Theme keys (each can be overridden inside a single image entry):

- `bg`, `bg2`: base gradient. `accent`: glows. `accent2`: emphasized words and highlight lines. `text`, `line`: derived from `bg` when omitted.
- `headline_font`, `headline_weight`, `em_style` (`normal`/`italic`), `font_links` (Google Fonts URLs, online only).
- `headline_lines`, `sub_lines`: room reserved so the device sits the same in every image. Give every image an `eyebrow` (small uppercase pill) or none.
- `device_max_w`: phone width as a fraction of canvas (default 0.78). In `dual` mode this is ignored; the two phones are sized to fit.
- `device_bleed`: how much of the phone may run off the bottom edge (default 0 — the whole phone shows, centered between the header and a bottom margin). Raise it for the "phone bleeds off the bottom" look.
- `frame`: `silver` (default), `titanium`, or `black` metal finish.
- `headline_align`: `left` (default, PocketPal editorial) or `center`. Set per image to vary it.
- `glow`: warm accent glow in the top corners, `true` by default. `false` for a perfectly flat background.
- `sparkles`: scattered `+`, `✦` and dot decoration in the accent color, `true` by default. `false` to remove it.
- `grain`: subtle film grain, `false` by default.
- `platform` (`ios`/`android`), `frame` (`black`/`titanium`/`silver`), `cutout` (`false` hides the Dynamic Island / camera hole — set it when the screenshot already includes a status bar).
- **`rotation`** (`flat`, `subtle`, `left`, `right`): in-plane (2D) tilt for single mode — the phone rectangle is not distorted, it just leans. `flat` is straight. `subtle` −2°, `left` −5°, `right` +5°. Purely visual; the phone stays centered in its slot. See "Rotation".
- **`mode`** (`single` default, or `dual`): `dual` renders two phones, both leaning the same way, front-right larger. See "Dual light/dark".
- **`frame2`**: frame finish for the second phone in `dual` mode (defaults to `frame`). Useful to pair, e.g., a black frame (dark UI) with a silver one (light UI).
- `scene`, `scene_vars`, `background_image`, `background_position`, `scrim`: backgrounds — see "Backgrounds".

Image keys: `screenshot`, `out`, `headline` (`\n` = line break, `*text*` = emphasis), `sub`, `eyebrow`, `pattern`, **`screenshot2`** (required in `dual` mode — the back phone), **`callouts`** (floating pills, see below), plus any theme key (most usefully `rotation`, `mode`, `frame2`, `headline_align`, `scene`).

## Targets

`targets` lists which store sizes to produce. Each one renders the whole `images` set at that canvas size into `<out_root>/store/<target>/`, and sets the phone frame automatically — **Apple targets get an iPhone frame, Google targets an Android frame** (this overrides `theme.platform`).

Default: `["apple/iphone", "google/phone"]`. The rest are opt-in:

| target | size | frame |
|---|---|---|
| `apple/iphone` | 1206×2622 (6.3") | iPhone |
| `apple/ipad` | 2048×2732 (12.9"/13") | iPhone |
| `google/phone` | 1080×1920 | Android |
| `google/tablet7` | 1080×1920 | Android |
| `google/tablet10` | 1440×2560 | Android |
| `google/desktop` | 1440×2560 | Android |
| `google/xr` | 1080×1920 | Android |

Output lands in `store/apple/iphone/`, `store/google/phone/`, etc. **Set `out_root` to the app's project folder** so the `store/` tree is created there, not next to the config. Every target reuses the same screenshots, headlines, callouts and theme; only the canvas size and frame change.

## App icon and feature graphic

Add both keys to the same `set.json`; `render.mjs` writes them next to the screenshots:

```json
"icon": "../assets/icon/app.png",
"feature_graphic": { "name": "Reword", "tagline": "Say it *better*." }
```

- `icon` — the app's square logo, 1024 px or larger. Written as `store/apple/icon.png` (1024×1024) and `store/google/icon.png` (512×512, under 1 MB), both opaque RGB: transparent areas get the theme's `bg`, because App Store Connect rejects an icon with alpha. The logo is resized only, never redrawn.
- `feature_graphic` — the Google Play 1024×500 banner (PNG, no alpha, under 15 MB), `store/google/feature-graphic.png`: the icon, the app `name` and a short `tagline` (`*text*` = accent) centred on the theme background. Play crops its edges and puts a play button over the centre when a promo video is set, so keep the tagline to a few words. Needs `icon`. For another layout, edit `assets/feature.html`.

## Rotation

`rotation` leans a single phone in-plane (2D) — the rectangle stays undistorted, no perspective. Presets, not free degrees, so a set stays consistent:

- `flat` — straight on. Safest; use when the screenshot content must read fully.
- `subtle` — a small backward tilt. Adds depth without hiding much.
- `left` / `right` — leans the phone counter-clockwise / clockwise. Keep one direction across a set, or alternate deliberately.

Keep one rotation across the set, or alternate `left`/`right` deliberately. To change the actual angles, copy `assets/template.html` and edit the `.rot-*` rules (see "Custom templates").

## Dual light/dark

`mode: "dual"` places two phones in one image, both tilted the same way (PocketPal "two themes" look): the **front** phone (`screenshot`) is larger, lower and to the right; the **back** phone (`screenshot2`) is smaller, higher and to the left, tucked behind. Give it `screenshot` (front) and `screenshot2` (back) — typically the light and dark versions of the same screen.

- Both screenshots should share aspect ratio; the front one sets the scale.
- Pair frames with `frame` + `frame2` (e.g. `black` front phone, `titanium` back phone) so each reads against the background.
- The headline sits above both phones. Keep it short — two phones take more width.
- Backgrounds (`pattern`, `scene`, `background_image`) work the same; a calm background reads best behind two phones.

## Callouts

`callouts` on an image draws floating pills that hang off the phone's edge (PocketPal signature — "Rs 281 → Groceries", "19d left"). Each is `{ "text": "...", "at": "top-left", "accent": true, "dot": false }`:

- `at`: `top`/`mid`/`bottom` + `-left`/`-right` (e.g. `mid-right`). They sit mostly outside the phone so they don't cover UI; pick a corner where the screen behind is calm.
- `accent: true` fills the pill with the accent color (use for the one key message); otherwise it's a translucent chip.
- `dot: false` removes the leading dot.
- **Say something the screenshot doesn't already show** — a benefit like "Works offline", "No account needed" — not text that's already visible on screen.
- Optional: an image with no `callouts` just shows the clean phone. Keep them sparse, 1–2 per image.

## Backgrounds

Best first.

1. **A scene per image, derived from its own screenshot** — the strongest result. Build a background that continues the screen's own elements outside the device. See `references/visual-directions.md`.
2. **A scene image** via `background_image` (brand imagery, public-domain/licensed images with the license reported, or a generated background with no phone/UI in it). `scrim` (0–1) tints it toward `bg`.
3. **An HTML scene** via `scene` (a `<style>` + markup + optional inline `<svg>`/`<script>` fragment). It reads `scene_vars` from `window.SCENE`, and after layout the page fires a `store:layout` event with the `canvas`, `device`, and `screen` boxes in pixels — draw decoration in the side gutters from those measurements, never fake app UI.
4. **Built-in patterns** — `pattern` is `rings`, `dots`, `grid`, `rays`, `arcs`, `diagonal`, `frames`, or `none`, over the `bg` gradient with `accent` glows and grain. Quick and safe.

**Custom templates.** For a look the config can't express, copy `assets/template.html`, edit the CSS, and point `"template"` at the copy. Two rules: never put filters, overlays, or tints on the screenshot `<img>`, and never use the `vh` unit or `innerHeight` (headless Chrome lays out in a shorter viewport than it captures — use `var(--vh)` and `var(--canvas-h)`).

## Store listing text

The text the store consoles ask for, written from the project itself, never from a template.

**Learn the app first.** Read the README, the manifest (`pubspec.yaml`, `package.json`, `build.gradle`, `Info.plist`), the screenshots, and the headlines you wrote for them. Take the name from what actually ships (Android `android:label`, iOS `CFBundleDisplayName`, the app title in code). Scan the dependencies for ads, web views, chat, and sign-in: the age rating answers depend on them. List the permissions each store needs — iOS `Info.plist` purpose strings, the Android merged manifest's permissions and any Play Console declaration they trigger — see `references/listing-guide.md` → **Permissions**. Ask the user only for what the project can't tell you, such as pricing or what a server does.

**Write one JSON per language** at `<project>/store/listing.json` (`listing-en.json` for a second language), with only the stores the user chose:

```json
{ "locale": "tr",
  "apple": { "name": "", "subtitle": "", "promotional_text": "", "description": "", "keywords": "",
             "category": { "primary": "Finance", "secondary": "Productivity" },
             "age_rating": { "result": "4+", "answers": { "Advertising": "No" } },
             "privacy_policy_url": "https://<owner>.github.io/<repo>/", "price": "Free",
             "app_privacy": { "tracking": false, "data": [ { "type": "Email Address", "purposes": ["App Functionality"],
                                                             "linked": true, "tracking": false, "why": "" } ] },
             "app_id": { "description": "", "bundle_id": "", "capabilities": [ { "name": "", "why": "" } ],
                         "app_services": [], "capability_requests": [] },
             "permissions": [ { "name": "NSCameraUsageDescription", "text": "", "why": "" } ] },
  "google": { "name": "", "short_description": "", "full_description": "", "package": "",
              "permissions": [ { "name": "android.permission.CAMERA", "why": "", "declaration": "" } ] } }
```

**Validate and write the files:**

```bash
node <skill-dir>/scripts/listing.mjs <project>/store/listing.json
```

It prints each field's length against its limit, then writes `listing.md` (readable, with a length table) and `listing.txt` (ready to paste) next to the JSON. While any field is over its limit it writes nothing and exits 1: shorten and re-run until it exits 0. Never count characters yourself.

Read `references/listing-guide.md` before writing: limits, per-field rules, what each store indexes for search, the category list, and the full age rating questionnaire. Answer every age rating item from evidence, and tell the user which answers to confirm in App Store Connect, since the declaration is theirs.

App Store Connect blocks submission until the primary category, privacy policy URL, App Privacy answers and price are set, so `listing.mjs` refuses an `apple` section without `category.primary`, `privacy_policy_url`, `price` and `app_privacy`. Answer App Privacy from the same SDK evidence as the privacy policy — see `references/listing-guide.md` → **App Store submission blockers** and **App Privacy**. Ask the user for the price.

## Privacy policy page

Both stores need a public privacy policy URL. Write the policy from what the project actually does — every SDK that sees user data (auth, analytics, crash reporting, payments, ads, AI), what stays on the device, how to delete the account — in the listing's language plus English when they differ, as `<project>/store/privacy-policy.md`. Keep an existing policy and only update what changed.

Publish it as a styled page with GitHub Pages instead of pasting text into a site builder:

```bash
node <skill-dir>/scripts/privacy.mjs <project>/store/privacy-policy.md <project>/site \
  --name Reword --accent '#5b3fd6' --icon <project>/assets/icon.png --workflow
```

It writes `site/index.html` (contents box, light and dark themes, tables) and `.github/workflows/pages.yml`, which publishes **only** `site/` — never point Pages at `docs/` or the repository root, because everything published is public even when the repository is private. GitHub Pages on a private repository needs a paid GitHub plan; on a free plan use a separate public repository holding only the page. Render the page in headless Chrome and look at it before going further.

Going live is outward-facing, so propose it and let the user approve each step: commit `site/` and the workflow on a branch, merge or push to the default branch, then switch Settings → Pages → Source to "GitHub Actions" (`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`). The URL is `https://<owner>.github.io/<repo>/`; put it in both consoles and in `privacy_policy_url` of every listing JSON.

## Store videos

The two stores want different things, so they are two different videos:

| | Google Play promo | App Store app preview |
|---|---|---|
| Delivered as | a **YouTube URL** pasted in the Play Console | an uploaded file, per device size |
| Size | 1080×1920 (portrait; no black bars) | 886×1920, at most 30 fps |
| Length | anything, but only the first 30 s autoplay | **15–30 s**, enforced |
| Content | a promo is fine; the app's own UI should fill most of the first 10 s | **screen captures of the app only** (Guideline 2.3.4); text overlays allowed, no device frames, no other platform's UI (2.3.10) |

Both are cut from **real screen recordings** of the app in use, never from screenshots or mockups, and both follow one **storyboard**: a hook, chapters that each show one benefit (a progress rail at the top fills chapter by chapter, so the viewer always knows where the story is), an optional trust beat, and — Google only — an outro card. The Google promo plays the footage in one persistent phone that enters in 3D and takes overlays such as a receipt that flies into the phone. The App Store preview runs the same story as full-frame captures with captions only: no device frame, overlay art or title cards.

**Three files per language.** `store/google/video/promo.mp4` (Google Play), `store/apple/video/preview.mp4` (the App Store app preview, screen captures only) and `store/apple/video/promo.mp4` — the Google film at iPhone size, with the frame, receipt and money effects, for the website, social and ads. Never tell the user to upload the iPhone promo to App Store Connect: device frames and overlay art break Guideline 2.3.4. Money (`coins`, in the `currency` symbol) can fly into the phone on any chapter — on the opening screen it reads as "payday", on a goal it reads as saving.

**Language.** English by default whenever the app has an English UI — store videos are for a global audience. Another language only when the user names it: copy `video.json` to `video.<lang>.json`, set `suffix` (files become `promo-<lang>.mp4`), translate the hook, chapters, captions, tagline and CTA, and record that language's own take. If the app cannot do a shown feature in that market (a receipt reader that only knows one country's format), say so before filming it — a promo must not show what the product cannot do there.

**Write the storyboard first and get it approved before recording.** One table: scene, seconds, what is on screen, the caption, the motion. Build it from the app's own features and store headlines (the strongest real moment — scanning a receipt, a number updating after a save — is the centre of the film). Give every chapter one effect that comes from what the screen is doing — money flying in when money moves, the scanned document flying into the phone — chosen from the table in `references/store-videos.md`. Use the user's royalty-free music choice; the default `synth` bed runs at 96 BPM, so make every scene a multiple of 0.625 s.

**One-time setup** (ask before installing anything):
- FFmpeg and FFprobe on PATH — Windows `winget install Gyan.FFmpeg`, macOS `brew install ffmpeg`.
- HyperFrames runs through `npx hyperframes` (Node 22+). Run `npx hyperframes browser ensure` once: on some Windows machines system Chrome and Edge hang on the `--version` probe, and HyperFrames' pinned build does not. The script points `HYPERFRAMES_BROWSER_PATH` at that build itself.

**Recording.** Record it yourself: ask once before touching the user's phone, then install a release build, reset to a seeded state, set the theme, language and currency, rehearse the flow over adb, and record one continuous take per language with `scripts/adbui.sh`. The full playbook — presses Flutter accepts, keyboard timing, ASCII-only typing, gating each step, what adb cannot do (system pickers) and how to involve the user for that one tap, cleaning up — is in `references/store-videos.md`. Only fall back to the user walking through the flow when no phone or simulator can be driven.

**Write `<project>/store/video.json` and render.** The full schema is at the top of `scripts/video.mjs`:

```json
{ "out_root": "..", "name": "Monysa", "tagline": "…", "icon": "../assets/icon/app.png", "currency": "$",
  "theme": { "bg": "#0B1220", "bg2": "#15243B", "accent": "#22C55E", "accent2": "#FBBF24", "text": "#ffffff" },
  "music": "synth", "crop": { "top": 76, "bottom": 132 },
  "story": {
    "hook": { "lines": ["Payday hit.", "What's left by\n*month's end*?"], "seconds": 2.5,
              "apple_shots": [{ "src": "../raw/video/take-1.mp4", "from": 0, "to": 2.5 }] },
    "chapters": ["See", "Add", "Plan", "Save"],
    "scenes": [
      { "chapter": 0, "caption": "Your whole month,\n*on one screen*.", "shots": [{ "src": "../raw/video/take-1.mp4", "from": 0, "to": 3.125 }],
        "coins": { "at": 0.25, "y": 0.2, "count": 8 } },
      { "chapter": 1, "caption": "Scan the receipt,\n*it fills in the rest*.", "shots": ["…three cuts…"],
        "receipt": { "src": "../raw/receipt-en.png", "at": 0.95 } },
      { "trust": true, "caption": "No account. No server.\n*Your data stays yours.*", "shots": ["…"] } ],
    "outro": { "seconds": 3.75, "cta": "Download now" } } }
```

A scene lasts as long as its shots, so cut shots to the beat. Before choosing `from`/`to`, step through the recording frame by frame around every cut (`ffmpeg -i take.mp4 -vf "fps=30,select='between(t,18.8,20)',scale=120:-1,tile=12x3" -vsync 0 -frames:v 1 strip.png`): a cut must not show a system picker with the user's own photos, an opening or closing keyboard (Android's keyboard is another platform's UI on the App Store), or a half-finished transition. Keep one take per session so the numbers on screen stay consistent from scene to scene.

```bash
node <skill-dir>/scripts/video.mjs <project>/store/video.json --only google --fast   # iterate (~1 min)
node <skill-dir>/scripts/video.mjs <project>/store/video.json                         # final, every store
```

Paths are relative to `video.json`. The script writes a HyperFrames project per store to `store/.video/<store>/`, gates it with `npx hyperframes check`, renders it, and re-encodes to the store's spec: `store/google/video/promo.mp4` and `store/apple/video/preview.mp4`. It prints size, fps, length and audio for each, plus a warning for anything a store would reject. Theme colors come from the screenshot set's theme. The Google promo runs hook + scenes + outro and should stay under the 30 s that autoplay (the script warns); the App Store preview runs hook + scenes and must land in 15–30 s (the script stops otherwise).

**Music.** `"synth"` generates a simple, royalty-free bed with FFmpeg (the default). A path uses the user's own file, which must be licensed for commercial use in an app store video. `null` means silence; the App Store file still gets the stereo track Apple requires. Don't download "free" music on the user's behalf: many such licenses exclude redistribution or store listings.

**Review before delivering.** Pull a few frames (`ffmpeg -ss <t> -i promo.mp4 -frames:v 1 f.png`) and look at them. To change something, edit `store/.video/<store>/index.html` and preview it with `npx hyperframes preview store/.video/<store>`, or change `video.json` and re-run.

**Delivery notes for the user.** Google: upload the promo to YouTube (public or unlisted, ads off, not age-restricted, embeddable), then paste the URL into the Play Console's preview video field. Apple: upload the preview in App Store Connect under the matching iPhone size, and pick its poster frame there.

## Checklist Before Delivering

- `warnings` is empty for every image. An "upscaled" warning means the source is too small.
- `screen_box` is consistent across single-mode images of the set.
- Inside the frame, text/numbers/icons match the source; nothing meaningful is hidden by rounded corners or the cutout.
- Headline and sub are readable at ~300 px wide (store gallery size).
- In `dual` mode, neither phone clips the canvas edge and the overlap doesn't hide key UI on the back phone.
- With `rotation`, the tilt doesn't foreshorten important edge content off-screen.
- Output size matches the target store; no alpha channel.
- If `icon` was set: no "upscaled" warning, and the feature graphic's name and tagline read at a glance.
- Files numbered in gallery order; the user knows where the config is so they can edit copy and re-render.
- If listing text was written: `listing.mjs` exits 0, every claim matches what the app does today, and the user knows which age rating answers to confirm.
- If videos were made: `video.mjs` printed no warnings; you looked at one frame per second of every film and at full-frame-rate strips across every cut and every effect (effects visibly move and land on the element they explain); no cut shows a system picker, personal photos, a keyboard on the App Store preview, or a half-finished transition; the App Store preview is screen recordings only with the phone's bars cut; the films are in English unless the user asked otherwise; and the phone was put back the way you found it.

## More Guidance

- `references/visual-directions.md`: direction, headline tone, composition, category notes.
- `references/store-sizes.md`: exact App Store and Google Play sizes, counts, format rules.
- `references/store-videos.md`: recording the app yourself over adb, finding clean cuts, and choosing effects that follow the action.
- `references/listing-guide.md`: store listing limits, per-field writing rules, App Store categories, the age rating questionnaire.
- `examples/set.reword.json`: a worked set using all four presentations (dual, left, subtle, flat).
