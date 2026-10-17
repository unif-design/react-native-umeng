# Umeng owned native verification — RN 0.88.0

Verified locally on 2026-10-16. Original production files are compiled directly. No publication, native application build, installation or device acceptance is included in this report.

| Measurement | Scope | Result |
| --- | --- | --- |
| Android JaCoCo | All 11 Kotlin files / 33 classes | Instructions 3000/3000; branches 255/255; lines 758/758; methods 173/173; classes 33/33; complexity 303/303 |
| iOS owned-source physical lines, cross-instrumented | All 6 Objective-C++ files, union of every line observed by either collector | 654/654 (100%) |
| iOS LLVM original | Same six files | Functions 84/84; explicit source branches 162/162; lines 793/795; regions 388/392 |
| iOS GCOV original | Same six files | Functions 96/96; lines 559/561; control-flow branches 488/791 |

Android: 51 JUnit tests pass, followed by normal and terminal process scenarios executing actual React Native bridge methods and production adapters. Kotlin 2.2.0 comes from the upgraded example. JaCoCo 0.8.13 is pinned and checksum verified. Owned compiled classes are selected by actual SourceFile metadata, including sibling and nested classes.

iOS: 35 XCTest cases pass (31 existing Analytics/Bootstrap/Share cases plus 4 runtime/bridge cases). Foundation, dispatch, locks, weak references, exceptions and XCTest are real. Only Android/UIKit/RN/vendor interfaces are substituted at the external boundary. Headers contain declarations/enums only.

The iOS build enables LLVM source instrumentation and GCOV on the same original .mm files. Original @try/@catch syntax is retained. The source hashes are taken before compilation and checked afterward; a changed file fails the run. Every unique physical line present in either collector is included. A line passes only if LLVM or GCOV has an actual positive execution count for that same source hash. Unknown lines or two zero counts fail. The original summaries and raw profiles are preserved without changing any counter. The physical-line union differs from the tools' own line denominators, which include different source ranges, closure instantiations and generated cleanup locations.

LLVM's upstream source coverage mapping has CXXTry/CXXCatch visitors, but no equivalent Objective-C try/catch visitors: [LLVM CoverageMappingGen.cpp](https://github.com/llvm/llvm-project/blob/main/clang/lib/CodeGen/CoverageMappingGen.cpp). The local minimal reproduction and raw profiles are in coverage/native/objc-exception-counter.*. GCOV correctly counts these Objective-C handlers, while its implicit exception/cleanup control-flow branches are a larger denominator than explicit source branches. LLVM regions remain 388/392, and no single-tool four-metric 100% claim is made.

The complete line-by-line table is coverage/native/ios/line-evidence.csv and .json. Collector discrepancies are:

| Source | Line | LLVM execution count | GCOV execution count |
| --- | ---: | ---: | ---: |
| ios/UmengAnalytics.mm | 23 | 8.0 | 0 |
| ios/UmengBootstrap.mm | 166 | 0.0 | 10 |
| ios/UmengBootstrap.mm | 167 | 0.0 | 10 |
| ios/UmengBootstrap.mm | 175 | 0.0 | 4 |
| ios/UmengBootstrap.mm | 176 | 0.0 | 4 |
| ios/UmengShare.mm | 45 | 2.0 | 0 |

Commands:

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home JACOCO_HOME=/tmp/unif-rn88-jacoco python3 scripts/test-native-android.py
bash scripts/test-native-ios.sh
```

Final logs: coverage/native-android-final.log and coverage/native-ios-final.log. Complete source inventories and SHA-256 hashes: coverage/native/android/scope.json and coverage/native/ios/scope.json. Raw original reports: android/coverage.xml, android/jacoco.exec, ios/coverage.json, ios/umeng-tests.profdata, ios/gcov/*.gcov and ios/gcov-summary.json. HTML reports remain alongside.

Production simplifications express existing invariants without excluding source: settled requests do not need a duplicate generation guard; teardown completion is owned until destruction or permanent invalidation; validated configuration exists once initialization is committed; String trimming and NSError descriptions are non-null. Tests assert terminal precedence, retries, rollback suppression, in-flight concurrency, nested callbacks and duplicate settlement.

This measures owned library logic. Native example hosts, generated RN specs, full native application builds, device SDK behavior, credentials/entitlements, analytics delivery and real share-app acceptance are separate gates. It does not claim every repository/tool script or any device flow has 100% coverage.
