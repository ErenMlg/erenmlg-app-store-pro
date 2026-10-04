# Store videos — recording playbook and effects

Read this before recording or cutting a store video. `SKILL.md` → **Store videos** has the
deliverables and the `video.json` shape; this file is how to get footage that is worth cutting
and how to make the film feel alive.

## Language

Record and caption in **English** whenever the app has an English UI, even when the project or the
user writes another language — store videos are for a global audience. Make another language only
when the user names it, as a second `video.<lang>.json` with its own take. If the app has no English,
use its main language and say so.

For each language, switch the app's own language (and, if it has one, its currency) through its
settings before recording; never fake a translated UI. Rename seeded data that shows on screen into
that language (a goal called "Araba" becomes "Car"). Overlay art follows the language too: an
English video gets an English receipt.

## Recording: drive the phone yourself

The default is that you record, not the user. Ask once before touching their phone (notifications,
photos and other apps can show), then do everything over adb. Helpers: `scripts/adbui.sh`.

**Setup, off camera**
1. `adb devices` — exactly one phone. Turn on Do Not Disturb; note the system theme and put it back
   afterwards.
2. Build and install a **release** build (no debug banner). If the toolchain fails (for example a JDK
   the build tool does not support), fix it for this build only — a JDK in the scratchpad and
   `JAVA_HOME` for the Gradle call — never by changing global config. Plugin registrants regenerated
   by `flutter analyze` can break a release build; `flutter build apk --release --config-only`
   regenerates them for release. If release signing points at a keystore that is not on this
   machine, build `assembleProfile` instead (AOT, no debug banner, debug-signed) and never go
   looking for the keystore. Pass the app's `--dart-define-from-file` values to a direct Gradle call
   as `-Pdart-defines=<comma-separated base64 of KEY=VALUE>`.
3. Start from a known state: `adb shell pm clear <package>` gives a fresh install, which usually
   seeds example data. An empty app makes a poor film — if it does not seed, add realistic data
   through the UI before recording.
4. Use the system theme the store images use (`adb shell cmd uimode night yes|no`).
5. Get through onboarding and any setting changes (language, currency, renames) before the take.

**Rehearse, then record**
- Rehearse the whole flow once without recording. Read positions with `adbui.sh ui`; never guess
  coordinates. Note where each element is after the keyboard closes — layouts move.
- Press by label with `adbui.sh tap "Label"`: it sends a 100 ms press and, if the screen did not
  change, a plain tap — some Flutter widgets take only one of the two.
- After closing the keyboard (`adb shell input keyevent 4`), wait about 1.5 s before the next press,
  or it lands mid-layout and is lost.
- `adb shell input text` cannot type non-ASCII. Type ASCII words, one character at a time
  (`adbui.sh type`), so typing reads on camera.
- Gate every step on what the screen says (`adbui.sh wait "Label" || exit 1`), with a label that
  exists **only** on the screen you expect — a label shared by two screens passes when the step
  failed. Check the screen before every press, not just after: a press meant for one screen can land
  on a destructive button of another (an account screen's "Delete my account").
- Steps that need judgement on camera (picking the right answer in a quiz, typing a word you only
  learn when it appears) break the take into segments: start the recorder detached
  (`adb shell 'nohup screenrecord ... /sdcard/seg.mp4 >/dev/null 2>&1 &'`), read the screen,
  decide, act in the next call, and cut the waits out later. Prefer multiple choice over typing when
  the app has it — typed answers can be rejected for a plural or a synonym.
- Apps that keep data behind an account: never create one on a live backend without the user's
  go-ahead; use a reserved test address (`@example.com`), and offer to delete it afterwards.
- Hold 1.5–2.5 s on every screen so there is footage to cut.
- One continuous take per language, start to finish, so the numbers on screen stay consistent from
  scene to scene. A scene cut from another take shows other numbers.

```bash
adb shell screenrecord --bit-rate 12000000 --time-limit 180 /sdcard/take.mp4 &   # one take
# ... drive the flow, logging a timestamp per step ...
adb shell pkill -INT screenrecord; wait
adb pull /sdcard/take.mp4 <project>/raw/video/take-<n>.mp4 && adb shell rm /sdcard/take.mp4
```

**What adb cannot do.** System pickers (Android's file picker, some photo pickers) may ignore
injected input. Then the user has to make that one tap: put the file in the gallery first
(`adb push` + a media-scan broadcast), confirm they are at the phone, tell them exactly which
thumbnail to tap, and wait for focus to return to the app (`dumpsys window | grep mCurrentFocus`).
Pickers show the user's own photos — never let those frames into a cut.

**Afterwards.** Remove anything you pushed to the phone, put the theme back, and tell the user what
state the app was left in.

**iOS.** `xcrun simctl io booted recordVideo <file>.mov` on the Simulator; drive it with the same
rehearse-then-record discipline.

## Finding the cuts

The recording is variable frame rate and its timestamps drift from the times you logged, so find
every cut on the frames themselves:

```bash
ffmpeg -i take.mp4 -vf "fps=1,scale=150:-1,drawtext=text='%{pts\:flt}':x=3:y=3:fontsize=14:fontcolor=yellow,tile=12x6" -frames:v 1 sheet.png
ffmpeg -i take.mp4 -vf "fps=30,select='between(t,18.8,20)',scale=120:-1,tile=12x3" -vsync 0 -frames:v 1 strip.png
```

A cut must not show: a system picker or anything personal, an opening or closing keyboard (on the
App Store, Android's keyboard is another platform's UI), a half-finished transition, or a press that
did nothing. Measure the status and navigation bars on one frame and set `crop`.

## Effects that follow the action

Every chapter should have one moment of motion that comes **from what the screen is doing**, timed to
land just as the screen shows it. Pick from the app's own world; never decorate for its own sake, and
never put something on screen the app does not do.

| On screen | Effect | `video.json` |
|---|---|---|
| Money arriving, being saved, paid | coins and notes in the app's currency fly into the phone | `coins: { at, y, count }` + top-level `currency` |
| A document turned into data (receipt, ticket, card, ID) | the real document slides in, a scan line passes, it flies into the phone just as the filled form appears | `receipt: { src, crop, at }` |
| Likes, favourites, achievements, steps, streaks, messages | the matching glyphs fly in on chips | `burst: { at, y, glyphs: ["❤️", "⭐"] }` |
| A chapter change | the style's transition | automatic |

Never zoom into the phone's screen: scaling the recording up softens the app's text and reads as a
lower-quality capture. Point at an element with a token flight aimed at it, or let the caption
name it.

Aim the effect (`y`, 0–1 of the screen height) at the element it explains, and have it arrive a beat
before that element updates. The overlay art must be real: the receipt that flies in is the one the
app actually reads in the take.

The App Store preview gets none of the overlays (captions only); the Google promo and
the iPhone promo get all of them.

## Checking the render

Look at frames, not at the timeline: one frame per second for the whole film, then a strip at full
frame rate across every effect and every cut. An effect that "plays" in the composition can still
read as frozen — an ease that leaves things still for half their flight looks stuck — so judge
motion on consecutive frames. `npx hyperframes snapshot --at <t>` shows single moments while
iterating.

## Styles

`"style"` in `video.json` picks the look; `scripts/styles.mjs` defines each one. All five share the
storyboard, footage and action effects — a look changes only how things move and what sits behind
the phone. The App Store preview keeps a look's type and caption motion but none of its overlay
layers.

| Style | Hook type | Phone enters | Chapter change | Background |
|---|---|---|---|---|
| `bold` | words pop in on a back-out ease | 3D fly-up from below | a scale kick | brand gradient, sparkles, glows |
| `minimal` | words rise and fade, light weight | fades up 60 px | the screen dips and returns | flat gradient, no decoration |
| `neon` | stepped glitch-in with skew | flashes in from 125 % | four-frame glitch with red/cyan bars | dark grid with a centre glow |
| `playful` | elastic pop with a twist | drops from above and bounces | squash-and-stretch on a spring | two drifting colour blobs |
| `cinematic` | blur resolves, staggered | slow 3D turn into place, then a gentle dolly | light leak while the screen blurs through | vignette |

Match the look to the app: finance and productivity read well as `bold` or `minimal`; developer,
crypto or gaming tools as `neon`; kids, habits, social and learning apps as `playful`; premium,
lifestyle and photo apps as `cinematic`. Recommend one, but the user chooses.

**A style the user describes.** Map it to the closest preset and adjust the config (theme colours,
effect glyphs). When no preset is close, add a sixth entry to `styles.mjs` with the
same seven hooks (`hookIn`, `captionIn`, `captionOut`, `deviceIn`, `cut`, `css`, `overlays`, plus
optional `idle` and `backdrop`), built from the HyperFrames transition catalog
(`hyperframes-animation/transitions/catalog.md`) — never `Math.random`, `repeat: -1` or clock reads.

**Preview a style cheaply.** Render it with `--only google --fast` on the real footage (about a
minute) and compare frames across the hook, the phone's entrance and the first chapter change in
one grid image, rather than full-size frames per style.

## Cost: time and tokens

Measured on an 8-core Linux laptop for one 27 s film: `hyperframes check` 23 s, render 49 s
(draft 43 s — capture-bound, so draft barely helps), final encode 11 s, shot prep and music
about 17 s: **about 100 s per store, 5 minutes for all three stores of one language.** A take costs
about 75 s of recording plus 3–5 minutes of setup, an APK build 1–3 minutes.

Most of the cost is avoidable rework, not the render itself:

- **Iterate on one store.** `node video.mjs video.json --only google --fast` skips the check,
  renders at draft and encodes fast: about 60 s. Render every store without `--fast` once, after
  the film is approved — never re-render all of them to test a change.
- **Look cheaply first.** Every render writes `store/.video/<store>/review.png` (one 90 px frame
  per second, about 600 tokens). Read that first; pull full-frame-rate strips only around effects
  and cuts, at 100–150 px per tile, and never full-size frames of the whole film (2–3k tokens each).
- **Find bugs before the full render.** `npx hyperframes snapshot --at <t>` on the composition
  takes seconds; check every effect's first and last frame there and in a `--fast` render.
- **Don't burn takes.** Rehearse, gate each step on what the screen says, abort on the first
  failed step, and confirm the user is at the phone before any step that needs their tap. A failed
  take costs a full reset, a new take and another review.
- **Keep tool output small.** Grep render logs down to the result lines; never print HyperFrames'
  progress log or whole source files into the conversation.
