#!/usr/bin/env bash
set -euo pipefail

node scripts/verify-native-contract.mjs --platform android
./example/android/gradlew -p example/android testDebugUnitTest
./example/android/gradlew -p example/android :app:processReleaseMainManifest :app:assembleRelease

MERGED_MANIFEST="$(find example/android/app/build/intermediates/merged_manifests \
  -path '*release*' -name AndroidManifest.xml -print -quit)"
if [ -z "$MERGED_MANIFEST" ]; then
  echo "Release merged AndroidManifest.xml not found" >&2
  exit 1
fi
grep -F 'unif.reactnativeumeng.example.fileprovider' "$MERGED_MANIFEST"
grep -F 'unif.reactnativeumeng.example.wxapi.WXEntryActivity' "$MERGED_MANIFEST"
grep -F 'unif.reactnativeumeng.example.ddshare.DDShareActivity' "$MERGED_MANIFEST"
grep -F '@xml/react_native_umeng_file_paths' "$MERGED_MANIFEST"
grep -Pzo '<activity\b(?=[^>]*android:name="unif\.reactnativeumeng\.example\.wxapi\.WXEntryActivity")(?=[^>]*android:enabled="false")[^>]*>' "$MERGED_MANIFEST" > /dev/null
grep -Pzo '<activity\b(?=[^>]*android:name="unif\.reactnativeumeng\.example\.ddshare\.DDShareActivity")(?=[^>]*android:enabled="false")[^>]*>' "$MERGED_MANIFEST" > /dev/null
