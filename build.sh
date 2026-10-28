#!/usr/bin/env bash
set -euo pipefail

if [ -z "$ANDROID_HOME" ]; then
  echo "defina ANDROID_HOME apontando para o Android SDK"
  exit 1
fi

if [ ! -f "./gradlew" ]; then
  gradle wrapper --gradle-version 8.7
fi

./gradlew :app:assembleDebug --no-daemon

echo
echo "APK: app/build/outputs/apk/debug/app-debug.apk"
echo "adb install -r app/build/outputs/apk/debug/app-debug.apk"
