# Native implementation coverage

The runners compile and instrument the repository's original native sources. They do not copy implementation logic into a test model. Every production Kotlin file in `android/src/main/java/com/unif/reactnativeumeng` and every Objective-C++ file in `ios` is included. Missing files or any uncovered counter fail the run. Generated React Native specs and third-party framework interfaces are external boundaries.

Run from the repository root:

```sh
JAVA_HOME=/path/to/jdk-17 JACOCO_HOME=/path/to/jacoco-0.8.13 python3 scripts/test-native-android.py
bash scripts/test-native-ios.sh
```

Android requires the example's configured Kotlin compiler and dependencies in the Gradle cache, JUnit 4.13.2; JaCoCo 0.8.13 is downloaded from official Maven with pinned SHA-256 validation, or reused from a strictly checked `JACOCO_HOME`. The runner reads the Kotlin compiler's POM for matching dependencies. It uses JaCoCo on the actual compiled production classes, selected by their `SourceFile` metadata, including sibling classes declared in each file. All Android JUnit tests run before the production bridge harness. A separate JVM verifies process-terminal initialization failure without mutating the singleton through reflection.

iOS requires Xcode's Clang, LLVM coverage tools, Foundation and XCTest. It compiles all original `.mm` files, the existing Analytics/Bootstrap/Share XCTest files, and additional bridge tests. UIKit, React Native Codegen, and Umeng vendor interfaces are narrow recording doubles. Foundation, dispatch queues, locks, exceptions, weak references and XCTest are real. A separate process verifies terminal initialization without resetting singleton state. Original Objective-C `@try/@catch` is retained. Apple Clang does not correctly count these handlers with LLVM source instrumentation, so the same build also uses GCOV instrumentation. Neither original report is altered.

Reports are written under `coverage/native/android` and `coverage/native/ios`. Each contains the raw report, HTML report, and `scope.json` with every measured source file's SHA-256 hash and exact counter denominator. Android gates instructions, branches, lines, complexity, methods and classes. iOS gates all owned physical lines using the union of positive execution counts from the two collectors for identical source hashes, plus both complete function reports and LLVM's explicit source branches. `line-evidence.json` and `line-evidence.csv` retain every line from either collector and both original counts. Unknown lines or lines with no positive count fail. Raw LLVM regions retain their compiler limitation; raw GCOV control-flow branches include implicit exception cleanup paths. Neither is relabeled as 100%.

The tests assert configuration normalization and errors, initialization ordering/idempotency/locking/retry/terminal behavior, callback component rollback, analytics and share payloads, cancellation and duplicate settlement, queued request rejection, host destruction/resumption, concurrent invocation teardown, permanent invalidation, and SDK/dispatcher/diagnostic failures. These results measure owned library logic. They do not establish vendor SDK behavior on a device, network analytics delivery, installed target-app behavior, credentials or entitlements, example host coverage, or complete native application builds. Those are separate integration checks.
