#!/usr/bin/env bash
# Drive an Android phone over adb for store-video recordings.
#
#   adbui.sh ui                  list on-screen elements: text|content-desc|bounds
#   adbui.sh has "Label"         exit 0 if an element with that text is on screen
#   adbui.sh wait "Label" [s]    wait up to s seconds (default 6) for it, exit 1 if it never shows
#   adbui.sh press X Y           a 100 ms press (Flutter ignores adb's zero-length `input tap`)
#   adbui.sh tap "Label"         press the centre of the first element with that text
#   adbui.sh type "ascii text"   type one character at a time so it reads on camera
#   adbui.sh shot out.png        save a screenshot
#
# `input text` cannot type non-ASCII (ş, ğ, é...): pick ASCII words for anything typed on camera.
set -euo pipefail

if ! command -v adb >/dev/null; then
  for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk"; do
    [[ -n "$sdk" && -x "$sdk/platform-tools/adb" ]] && PATH="$PATH:$sdk/platform-tools" && break
  done
fi

ui() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb shell cat /sdcard/ui.xml | grep -o -E '<node [^>]*>' \
    | sed -E 's/.*(text)="([^"]*)".*(content-desc)="([^"]*)".*bounds="([^"]+)".*/\2|\4|\5/' | grep -v '^||' || true
}

press() { adb shell input swipe "$1" "$2" "$1" "$2" 100; }

tap() {
  local b x1 y1 x2 y2
  b=$(ui | grep -F -m1 "$1" | awk -F'|' '{print $3}')
  [[ -n "$b" ]] || { echo "not on screen: $1" >&2; return 1; }
  # Bounds look like [x1,y1][x2,y2]; every bracket and comma becomes a space (deleting the
  # brackets instead would glue y1 and x2 into one number).
  read -r x1 y1 x2 y2 <<<"$(echo "$b" | tr '[],' '   ')"
  local x=$(( (x1 + x2) / 2 )) y=$(( (y1 + y2) / 2 ))
  # Some Flutter widgets take only a held press, others only a plain tap: send the press, and
  # if the screen did not change, the tap.
  local before; before=$(ui | md5sum)
  press "$x" "$y"; sleep 0.8
  [[ "$(ui | md5sum)" == "$before" ]] && adb shell input tap "$x" "$y"
  return 0
}

has() { ui | grep -qF "$1"; }

wait_for() {
  local i
  for ((i = 0; i < ${2:-6}; i++)); do has "$1" && return 0; sleep 1; done
  echo "never showed: $1" >&2; return 1
}

type_text() {
  local i
  for ((i = 0; i < ${#1}; i++)); do
    local c="${1:$i:1}"
    [[ "$c" == " " ]] && c="%s"
    adb shell input text "$c"; sleep 0.15
  done
}

shot() { adb exec-out screencap -p > "$1"; }

cmd="${1:-}"; shift || true
case "$cmd" in
  ui|has|press|tap|shot) "$cmd" "$@" ;;
  wait) wait_for "$@" ;;
  type) type_text "$@" ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
