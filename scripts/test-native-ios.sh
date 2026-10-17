#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/coverage/native/ios"
XCTEST_FRAMEWORKS="$(xcode-select -p)/Platforms/MacOSX.platform/Developer/Library/Frameworks"
mkdir -p "$OUTPUT"
python3 - "$ROOT" "$OUTPUT" <<'HASHES'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
hashes = {str(source.relative_to(root)): hashlib.sha256(source.read_bytes()).hexdigest() for source in (root / "ios").glob("*.mm")}
(pathlib.Path(sys.argv[2]) / "source-hashes-before.json").write_text(json.dumps(hashes, indent=2) + "\n")
HASHES
rm -f "$OUTPUT"/umeng-tests-*.gcda
xcrun clang++ -std=c++17 -fobjc-arc -fblocks -fprofile-instr-generate -fcoverage-mapping --coverage \
  -Wno-nullability-completeness -framework Foundation -F"$XCTEST_FRAMEWORKS" -framework XCTest -Wl,-rpath,"$XCTEST_FRAMEWORKS" \
  -I"$ROOT/scripts/native-tests/ios" -I"$ROOT/ios" \
  "$ROOT"/ios/*.mm "$ROOT/scripts/native-tests/ios/Boundary.mm" "$ROOT/scripts/native-tests/ios/Harness.mm" "$ROOT/scripts/native-tests/ios/RuntimeTests.mm" \
  "$ROOT/example/ios/ReactNativeUmengExampleTests/UmengAnalyticsTests.mm" \
  "$ROOT/example/ios/ReactNativeUmengExampleTests/UmengBootstrapTests.mm" \
  "$ROOT/example/ios/ReactNativeUmengExampleTests/UmengShareTests.mm" \
  -o "$OUTPUT/umeng-tests"
LLVM_PROFILE_FILE="$OUTPUT/umeng-tests.profraw" "$OUTPUT/umeng-tests"
LLVM_PROFILE_FILE="$OUTPUT/umeng-terminal.profraw" "$OUTPUT/umeng-tests" terminal
xcrun llvm-profdata merge -sparse "$OUTPUT/umeng-tests.profraw" "$OUTPUT/umeng-terminal.profraw" -o "$OUTPUT/umeng-tests.profdata"
xcrun llvm-cov report "$OUTPUT/umeng-tests" -instr-profile="$OUTPUT/umeng-tests.profdata" "$ROOT"/ios/*.mm
xcrun llvm-cov export "$OUTPUT/umeng-tests" -instr-profile="$OUTPUT/umeng-tests.profdata" "$ROOT"/ios/*.mm > "$OUTPUT/coverage.json"
xcrun llvm-cov show "$OUTPUT/umeng-tests" -instr-profile="$OUTPUT/umeng-tests.profdata" -format=html -output-dir="$OUTPUT/html" "$ROOT"/ios/*.mm
python3 - "$ROOT" <<'PYTHON'
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path
import sys

root = Path(sys.argv[1])
output = root / "coverage/native/ios"
report = json.loads((output / "coverage.json").read_text())["data"][0]
sources = sorted((root / "ios").glob("*.mm"))
if {Path(file["filename"]) for file in report["files"]} != set(sources):
    raise SystemExit("Incomplete owned iOS source coverage")
gcov_output = output / "gcov"
gcov_output.mkdir(exist_ok=True)
gcov_files = []
line_evidence = []
before = json.loads((output / "source-hashes-before.json").read_text())
for source in sources:
    notes = output / ("umeng-tests-" + source.stem + ".gcno")
    subprocess.run(["xcrun", "llvm-cov", "gcov", "-i", "-b", str(notes)], cwd=gcov_output, check=True, capture_output=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if before[str(source.relative_to(root))] != digest:
        raise SystemExit("Source changed while measuring coverage: " + str(source))
    source_lines = source.read_text().splitlines()
    shown = subprocess.check_output(["xcrun", "llvm-cov", "show", str(output / "umeng-tests"), "-instr-profile=" + str(output / "umeng-tests.profdata"), str(source)], text=True)
    llvm_lines = {}
    for row in shown.splitlines():
        match = re.match(r"^\s*(\d+)\|\s*([0-9]+(?:\.[0-9]+)?[kMG]?)\|", row)
        if match:
            number, rendered = int(match.group(1)), match.group(2)
            scale = {"k": 1000, "M": 1000000, "G": 1000000000}.get(rendered[-1], 1)
            count = float(rendered.rstrip("kMG")) * scale
            if number not in llvm_lines or count > 0:
                llvm_lines[number] = count
    gcov_lines = {}
    selected = False
    counts = {"lines": [], "functions": [], "controlFlowBranches": []}
    for line in (gcov_output / (notes.name + ".gcov")).read_text().splitlines():
        if line.startswith("file:"):
            selected = (root / line[5:]).resolve() == source
        elif selected and line.startswith("lcount:"):
            number, count = map(int, line[7:].split(","))
            counts["lines"].append(count)
            gcov_lines[number] = count
        elif selected and line.startswith("function:"):
            counts["functions"].append(int(line.split(",")[1]))
        elif selected and line.startswith("branch:"):
            counts["controlFlowBranches"].append(1 if line.endswith(",taken") else 0)
    if not counts["lines"] or not counts["functions"]:
        raise SystemExit("Missing gcov production source: " + str(source))
    measured = {metric: {"count": len(values), "covered": sum(value > 0 for value in values)} for metric, values in counts.items()}
    gcov_files.append({"path": str(source.relative_to(root)), "counters": measured})
    for number in sorted(set(llvm_lines) | set(gcov_lines)):
        llvm_count, gcov_count = llvm_lines.get(number), gcov_lines.get(number)
        covered = (llvm_count is not None and llvm_count > 0) or (gcov_count is not None and gcov_count > 0)
        line_evidence.append({"path": str(source.relative_to(root)), "line": number, "sha256": digest, "llvm": llvm_count, "gcov": gcov_count, "covered": covered, "source": source_lines[number - 1]})
gcov_totals = {metric: {key: sum(file["counters"][metric][key] for file in gcov_files) for key in ("count", "covered")} for metric in counts}
(output / "gcov-summary.json").write_text(json.dumps({"totals": gcov_totals, "files": gcov_files}, indent=2) + "\n")
print("Original Objective-C GCOV counters:", gcov_totals)
line_summary = {"count": len(line_evidence), "covered": sum(row["covered"] for row in line_evidence)}
(output / "line-evidence.json").write_text(json.dumps({"algorithm": "Union of every line reported by either original collector; covered only when at least one actual execution counter is positive for the identical source SHA-256.", "summary": line_summary, "lines": line_evidence}, indent=2) + "\n")
with (output / "line-evidence.csv").open("w") as stream:
    writer = csv.DictWriter(stream, fieldnames=list(line_evidence[0]))
    writer.writeheader()
    writer.writerows(line_evidence)
print("Owned-source cross-instrumented line coverage:", line_summary)
metrics = ("regions", "functions", "lines", "branches")
scope = {
    "instrumentation": "Apple Clang / LLVM source coverage",
    "scope": "Every production Objective-C++ source under ios",
    "llvmCounters": {metric: report["totals"][metric] for metric in metrics},
    "gcovCounters": gcov_totals,
    "ownedSourceLines": line_summary,
    "limitations": "LLVM ObjC @try/@catch regions are unsupported and preserved without adjustment. GCOV contains implicit exception cleanup branches; explicit source branches are measured by LLVM. See line-evidence.json for each compiler discrepancy.",
    "files": [{
        "path": str(source.relative_to(root)),
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    } for source in sources],
}
(output / "scope.json").write_text(json.dumps(scope, indent=2) + "\n")
if any(not row["covered"] for row in line_evidence):
    raise SystemExit("Owned source has a line without a positive execution count from either collector")
for metric in ("functions", "branches"):
    if report["totals"][metric]["covered"] != report["totals"][metric]["count"]:
        raise SystemExit("Owned LLVM source " + metric + " coverage must be 100%")
if gcov_totals["functions"]["covered"] != gcov_totals["functions"]["count"]:
    raise SystemExit("Owned GCOV function coverage must be 100%")
print("Owned iOS source lines, functions and explicit branches passed; raw LLVM regions retain the documented compiler limitation")
PYTHON
