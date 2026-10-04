# erenmlg-app-store-pro

A [Claude Code](https://claude.com/claude-code) skill that turns a mobile app project into everything the
App Store and Google Play ask for before launch:

- **Store listing documents** — name, subtitle, promotional text, description, keywords, category and age
  rating answers for the App Store; name, short and full description for Google Play — plus the
  **identifiers** the consoles ask for first: the Google Play package name and the App Store App ID
  registration (description, explicit bundle ID, and which Capabilities, App Services and Capability
  Requests to enable, each backed by evidence from the project).
- **A privacy policy page** — rendered from Markdown into a styled, self-contained page and published with
  GitHub Pages, so it never has to be restyled by hand in a site builder.
- **Store screenshots** — the app's real screenshots, pixel-exact, in a device frame on a themed background
  with a headline, for every App Store and Google Play size, plus the app icon for both stores and the
  Google Play feature graphic (1024×500).
- **Store videos** — the skill installs the app on a phone or emulator, drives it over adb, records the real
  flow, and cuts a storyboarded film in one of five motion styles, with effects that follow what happens on
  screen. Three files per language: a Google Play promo, an App Store app preview (screen captures only, as
  Apple requires) and an iPhone-size promo for the web and social.

Videos are made in **English** whenever the app has an English UI; other languages only on request.

---

## Contents

- [How a first run goes](#how-a-first-run-goes)
- [Install](#install)
- [Requirements](#requirements)
- [Commands](#commands)
- [Video styles](#video-styles)
- [Effects that follow the action](#effects-that-follow-the-action)
- [What it produces](#what-it-produces)
- [Measured cost: time and tokens](#measured-cost-time-and-tokens)
- [Repository layout](#repository-layout)
- [Rules the skill keeps](#rules-the-skill-keeps)
- [Known limits](#known-limits)
- [Credits and license](#credits-and-license)

---

## How a first run goes

Invoke it from the app's project folder (`/erenmlg-app-store-pro`, or just ask for store screenshots,
a store video or a listing). Nothing is rendered or recorded before the plan is approved.

1. **Analyze the project — no questions.** README, manifest (`pubspec.yaml`, `package.json`,
   `build.gradle`, `Info.plist`), the shipped name, UI languages, screens and main flow, what needs an
   account or backend, whether a fresh install seeds example data, how it builds, existing raw screenshots.
2. **Write the store documents.** Listing text for both stores, the package name, the App ID registration
   and its capabilities, validated by `scripts/listing.mjs`; then the privacy policy page.
3. **Ask once.** Video style (five presets or one you describe), screenshot sizes, rotation, background,
   and whether to make videos.
4. **Show the plan.** One page — published as an Artifact when available — with every screenshot and its
   copy, and the video storyboard scene by scene: what is on screen, the caption, the effect, the style's
   transition and the seconds per scene. Revise until approved.
5. **Choose the device.** Connected phones (`adb devices -l`), Android emulators (`emulator -list-avds`)
   or iOS simulators on macOS.
6. **Produce the screenshots**, capturing fresh raw shots from the device if needed.
7. **Produce the videos** — record, cut, iterate on one store in fast mode, then render every store once.
8. **Review and deliver**, with a checklist for every image and film, and a note on the state the device
   and any backend were left in.

---

## Install

```bash
git clone https://github.com/ErenMlg/erenmlg-app-store-pro.git
cp -r erenmlg-app-store-pro/skills/erenmlg-app-store-pro ~/.claude/skills/
```

Claude Code picks the skill up on the next session. It shows up as `erenmlg-app-store-pro`.

## Requirements

| For | Needs |
|---|---|
| Screenshots | Node 18+, a Chromium-based browser (Chrome, Chromium, Edge, Brave; `CHROME_PATH` if not found) |
| Listing, privacy page | Node 18+; `git` for the Pages workflow |
| Videos | Node 22+, FFmpeg and FFprobe on `PATH`, [HyperFrames](https://www.npmjs.com/package/hyperframes) via `npx` (`npx hyperframes browser ensure` once), `adb` and a phone or emulator — or the iOS Simulator on macOS |
| Building the app | the project's own toolchain (Flutter, Gradle, Xcode) |

No npm packages are installed; every script is plain Node.

---

## Commands

All script paths are relative to `skills/erenmlg-app-store-pro/`.

```bash
# Store listing: validate lengths, identifiers and capabilities; write listing.md and listing.txt
node scripts/listing.mjs <project>/store/listing.json

# Privacy policy page + a GitHub Actions workflow that publishes only site/
node scripts/privacy.mjs <project>/store/privacy-policy.md <project>/site \
  --name MyApp --accent '#5b3fd6' --icon <project>/assets/icon.png --workflow

# Screenshots for every target in the config
node scripts/render.mjs <project>/store-set.json

# Videos: iterate on one store fast, then render every store once
node scripts/video.mjs <project>/store/video.json --only google --fast
node scripts/video.mjs <project>/store/video.json

# Drive a phone over adb (used while recording)
scripts/adbui.sh ui | has "Label" | wait "Label" [s] | tap "Label" | press X Y | type "ascii" | shot out.png
```

The full `video.json` schema is at the top of `scripts/video.mjs`; the listing schema at the top of
`scripts/listing.mjs`.

---

## Video styles

A style changes how things move and what sits behind the phone — never the storyboard, the footage or the
action effects. Defined in `scripts/styles.mjs`, built from the HyperFrames transition catalog.

| Style | Hook type | Phone enters | Chapter change | Background | Suits |
|---|---|---|---|---|---|
| `bold` | words pop in on a back-out ease | 3D fly-up from below | a scale kick | brand gradient, sparkles, glows | finance, productivity |
| `minimal` | words rise and fade | fades up | the screen dips and returns | flat gradient | finance, utilities, B2B |
| `neon` | stepped glitch-in with skew | flashes in from 125 % | four-frame glitch with RGB bars | dark grid, centre glow | developer, crypto, games |
| `playful` | elastic pop with a twist | drops and bounces | squash-and-stretch | drifting colour blobs | kids, habits, learning, social |
| `cinematic` | blur resolves, staggered | slow 3D turn, then a gentle dolly | light leak while the screen blurs through | vignette | premium, lifestyle, photo |

A style the user describes is mapped to the closest preset, or added as a new entry in `styles.mjs`. The
App Store preview keeps a style's type and caption motion but none of its overlay layers.

Every film shares the same structure: a hook, chapters with a progress rail that fills chapter by chapter,
one persistent phone, an optional trust beat, and (except the App Store preview) an outro card with the
icon and a call to action. Scene lengths snap to the 96 BPM royalty-free music bed (0.625 s per beat).

## Effects that follow the action

| On screen | Effect | `video.json` |
|---|---|---|
| Money arriving, saved or paid | coins and notes in the app's currency fly into the phone | `coins` + `currency` |
| A document turned into data (receipt, ticket, card) | the real document slides in, a scan line passes, it flies into the phone as the filled form appears | `receipt` |
| Likes, favourites, achievements, streaks, messages | matching glyphs fly in on chips | `burst` with `glyphs` |
| A chapter change | the style's transition | automatic |

The screen itself is never zoomed: scaling a recording up softens the app's text.

---

## What it produces

```
<project>/
├── store/
│   ├── listing.json · listing.md · listing.txt     # listing + identifiers + capabilities
│   ├── privacy-policy.md
│   ├── apple/iphone/*.png   google/phone/*.png     # screenshots per target
│   ├── apple/icon.png   google/icon.png            # app icon, 1024 and 512 px
│   ├── google/feature-graphic.png                  # Play feature graphic, 1024×500
│   ├── google/video/promo.mp4                      # Google Play promo (upload to YouTube)
│   ├── apple/video/preview.mp4                     # App Store app preview (886×1920, 15–30 s)
│   ├── apple/video/promo.mp4                       # iPhone-size marketing film (not for App Store Connect)
│   ├── video.json                                  # the storyboard config
│   └── .video/<store>/                             # HyperFrames project per store + review.png
├── site/index.html                                 # privacy policy page
├── .github/workflows/pages.yml                     # publishes site/ only
└── raw/video/*.mp4                                 # recordings
```

A second language adds `video.<lang>.json` and `promo-<lang>.mp4` / `preview-<lang>.mp4`.

---

## Measured cost: time and tokens

All numbers come from real runs on an 8-core Linux laptop (16 GB RAM) with a Redmi Note 8 Pro over USB.
"Tokens" are the context tokens a run added to the conversation, read from the session's token counter;
billed tokens are higher because every tool call re-reads the cached context — use `/cost` in Claude Code
for the exact bill.

### Rendering one 27 s film

| Stage | Time |
|---|---|
| `hyperframes check` (lint, layout, contrast, motion) | 23 s |
| Render, delivery quality | 49 s |
| Render, draft quality | 43 s — capture-bound, so draft barely helps |
| Final encode | 11 s (8 s at `-preset medium`) |
| Shot prep and music | ~17 s |
| **One store, full pipeline** | **~100 s** |
| **One store, `--fast`** (no check, draft, fast encode) | **62–76 s** |
| **Three stores, final** | **~5.7 min** (340 s, ReWord) |
| Five style samples, `--fast` | 63–89 s each |

Rendering falls back to HyperFrames' screenshot capture on this machine (the bundled Chrome lacks
`HeadlessExperimental.beginFrame`), which is the slow path; machines with beginFrame render faster.

### Recording and building

| Step | Time |
|---|---|
| One continuous take | ~75 s |
| Setup per take (reset, onboarding, settings, rehearsal) | 3–5 min |
| Release / profile APK build | 1–3 min |

### Whole runs

| Run | What was made | Wall clock | Context tokens |
|---|---|---|---|
| Monysa (BudgetAnalyser), first versions, before the optimizations | TR + EN, 3 films each, many iterations | ~2.5 h over several turns | ~390k for the video work |
| ReWord, with `--only --fast`, review sheets and the playbook | TR, 7 chapters, 3 films | **~44 min** (incl. user answers) | **~96k** |

Where the 44 minutes went on ReWord: ~10 min project build problems (an API break with the current
Flutter, a release keystore on another machine), ~10 min failed takes (since fixed in the helper and the
playbook), ~8 min learning the app and preparing demo data, ~7 min rendering, the rest storyboard and
review. A run without those problems is expected around **25–30 min and 60–80k tokens** (estimate).

### What made the difference

- **Iterate on one store** with `--only google --fast` (~1 min) and render every store once at the end,
  instead of re-rendering all films for every change (~16 min each time on the first runs).
- **Review cheaply.** Each render writes `review.png` — one 90 px frame per second, about **600 tokens** —
  instead of full-size frames at **2–3k tokens** each. Full-rate strips only around cuts and effects.
- **Don't burn takes.** Gate every step on a label unique to the expected screen, abort on the first failed
  step, and confirm the user is at the phone before any step that needs their tap.
- **Keep tool output small.** Render logs are grepped down to the result lines.

---

## Repository layout

```
skills/erenmlg-app-store-pro/
├── SKILL.md                     # the workflow Claude follows
├── scripts/
│   ├── render.mjs               # screenshots → framed store images, every target size
│   ├── listing.mjs              # listing + identifiers validation, Markdown and text output
│   ├── privacy.mjs              # privacy policy Markdown → styled page + Pages workflow
│   ├── video.mjs                # media prep, HyperFrames render, store checks, --only / --fast
│   ├── story.mjs                # storyboard composer: hook, rail, phone, effects, trust, outro
│   ├── styles.mjs               # the five motion styles
│   └── adbui.sh                 # drive an Android phone over adb
├── references/
│   ├── store-videos.md          # recording playbook, cuts, effects, styles, cost
│   ├── listing-guide.md         # limits, per-field rules, categories, age rating, identifiers
│   ├── store-sizes.md           # App Store and Google Play sizes and format rules
│   └── visual-directions.md     # art direction for screenshots
├── assets/                      # screenshot template and example config
└── examples/set.reword.json     # a worked screenshot set
```

---

## Rules the skill keeps

- **The app's UI is never redrawn.** Screenshots and recordings are composited as-is; no image model touches
  them.
- **The App Store preview is screen captures only** — no device frame, overlay art or title cards
  (Guideline 2.3.4), no other platform's UI such as Android's keyboard or status bar (2.3.10).
- **A promo never shows what the product cannot do** in that market.
- **Outward-facing steps need the user's approval:** touching their phone, creating accounts on a live
  backend, pushing, enabling GitHub Pages.
- **Everything published by Pages is public**, even from a private repository, so only `site/` is
  published.
- **Deterministic renders:** no randomness, clock reads or endless repeats in the compositions.

## Known limits

- System pickers (Android's file picker) may ignore adb input; the user makes that one tap.
- `adb shell input text` cannot type non-ASCII characters, so anything typed on camera is ASCII.
- GitHub Pages on a private repository needs a paid GitHub plan.
- Store requirements change; the size and limit tables were checked in 2026 — verify when compliance is
  critical.

## Credits and license

Screenshot rendering started from the app-store-screenshot skill by Zafer Ayan (MIT). Videos are
rendered with [HyperFrames](https://www.npmjs.com/package/hyperframes). MIT licensed.
