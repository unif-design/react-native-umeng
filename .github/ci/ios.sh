#!/usr/bin/env bash
set -euo pipefail

node scripts/verify-native-contract.mjs --platform ios
bash scripts/test-native-ios.sh
python3 scripts/native/check_example_ios.py
xcodebuild test \
  -workspace example/ios/ReactNativeUmengExample.xcworkspace \
  -scheme ReactNativeUmengExample \
  -destination 'platform=iOS Simulator,name=iPhone 17'

PROVIDER="$(find example/ios/build/generated/ios \
  -name RCTModuleProviders.mm -print -quit)"
if [ -z "$PROVIDER" ]; then
  echo "Generated RCTModuleProviders.mm not found" >&2
  exit 1
fi
grep -F 'UmengCommon' "$PROVIDER"
grep -F 'UmengAnalytics' "$PROVIDER"
grep -F 'UmengShare' "$PROVIDER"
