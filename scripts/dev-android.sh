#!/bin/zsh
# One command for device work: builds the debug APK, installs it on the emulator/phone, then serves the UI from vite
# so every file save reloads on the device (Capacitor live-reload). Stop with Ctrl+C.
set -e
cd "$(dirname "$0")/.."

PORT=5173
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
export JAVA_HOME="$(node scripts/jdk.mjs)"

TARGET="${1:-$("$ADB" devices | awk 'NR==2 && $2=="device" {print $1}')}"

# nothing connected: boot the first AVD and wait for it, so the one command is enough
if [ -z "$TARGET" ]; then
  EMULATOR="$ANDROID_HOME/emulator/emulator"
  [ -x "$EMULATOR" ] || EMULATOR="$(command -v emulator)"
  AVD="$("$EMULATOR" -list-avds 2>/dev/null | head -1)"
  if [ -z "$AVD" ]; then
    echo "دستگاهی وصل نیست و شبیه‌سازی هم ساخته نشده: یک AVD در Android Studio بساز یا گوشی را با USB وصل کن."
    exit 1
  fi
  echo "شبیه‌ساز روشن نیست؛ $AVD را بالا می‌آورم…"
  nohup "$EMULATOR" -avd "$AVD" >/dev/null 2>&1 &
  "$ADB" wait-for-device
  # the device answers adb long before Android is up; cap run needs the real boot
  for _ in {1..120}; do
    [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 2
  done
  TARGET="$("$ADB" devices | awk 'NR==2 && $2=="device" {print $1}')"
  if [ -z "$TARGET" ]; then
    echo "شبیه‌ساز بالا نیامد؛ یک بار دستی اجرا کن و بعد دوباره همین دستور را بزن."
    exit 1
  fi
fi

# adb reverse lets the webview reach vite at localhost; without it (emulator) the host is 10.0.2.2
if "$ADB" -s "$TARGET" reverse "tcp:$PORT" "tcp:$PORT" >/dev/null 2>&1; then
  HOST=localhost
else
  HOST=10.0.2.2
fi

pnpm exec vite --host --port "$PORT" --strictPort &
VITE_PID=$!
trap 'kill "$VITE_PID" 2>/dev/null' EXIT INT TERM

pnpm exec cap run android --live-reload --host "$HOST" --port "$PORT" --target "$TARGET"
