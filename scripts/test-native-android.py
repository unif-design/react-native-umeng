"""Run production Kotlin against narrow Android/RN/vendor boundary doubles.

Requires the example Android build's cached Kotlin compiler and JDK 17+.
External Android, React Native and vendor SDKs are contract boundaries; their
behavior on a device is outside this host-side coverage measurement.
"""

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from native.coverage_tools import jacoco_tools

root = Path(__file__).resolve().parent.parent
cache = (
    Path(os.environ.get("GRADLE_USER_HOME", str(Path.home() / ".gradle")))
    / "caches/modules-2/files-2.1"
)


def cached(pattern):
    matches = sorted(cache.glob(pattern))
    if not matches:
        raise SystemExit(
            "Missing cached Kotlin compiler dependency: " + pattern
            + "; run bash .github/ci/android.sh first"
        )
    return str(matches[-1])


def dependencies(module):
    """Use the compiler's own POM instead of picking unrelated cached versions."""
    pom = ET.parse(cached(module + "/*/*.pom"))
    namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
    return [
        "/".join(dependency.findtext("m:" + field, namespaces=namespace)
                 for field in ("groupId", "artifactId", "version"))
        for dependency in pom.findall("m:dependencies/m:dependency", namespace)
    ]


build = (root / "example/android/build.gradle").read_text()
configured = re.search(r'kotlinVersion\s*=\s*"([^"]+)"', build)
if not configured:
    raise SystemExit("Cannot locate the example's configured Kotlin version")
version = configured.group(1)
compiler = "org.jetbrains.kotlin/kotlin-compiler-embeddable/" + version
stdlib = "org.jetbrains.kotlin/kotlin-stdlib/" + version
modules = [compiler, *dependencies(compiler), *dependencies(stdlib)]
classpath = [cached(module + "/*/*.jar") for module in dict.fromkeys(modules)]
stdlib_jar = cached(stdlib + "/*/*.jar")
annotations = [cached(module + "/*/*.jar") for module in dependencies(stdlib)]
java = (
    str(Path(os.environ["JAVA_HOME"]) / "bin/java")
    if "JAVA_HOME" in os.environ else shutil.which("java")
)
if not java:
    raise SystemExit("JDK 17+ is required; set JAVA_HOME")
production = root / "android/src/main/java/com/unif/reactnativeumeng"
sources = sorted(production.glob("*.kt"))
sources += sorted((root / "scripts/native-tests/android").glob("*.kt"))
sources += sorted((root / "android/src/test/java/com/unif/reactnativeumeng").glob("*.kt"))
junit = cached("junit/junit/4.13.2/*/*.jar")
hamcrest = cached("org.hamcrest/hamcrest-core/1.3/*/*.jar")
coverage = root / "coverage/native/android"
coverage.mkdir(parents=True, exist_ok=True)
agent, cli = jacoco_tools(root)
with tempfile.TemporaryDirectory(prefix="umeng-native-") as target:
    java_sources = list((root / "scripts/native-tests/android").rglob("*.java"))
    subprocess.run([str(Path(java).with_name("javac")), "-d", target, *map(str, java_sources)], check=True)
    command = [
        java, "-cp", os.pathsep.join(classpath),
        "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler",
        "-nowarn", "-no-stdlib", "-no-reflect",
        "-classpath", os.pathsep.join([stdlib_jar, *annotations, junit, target]),
        "-d", target, *map(str, sources),
    ]
    subprocess.run(command, check=True)
    result = subprocess.run([
        java, "-javaagent:" + str(agent) + "=destfile=" + str(coverage / "jacoco.exec") + ",append=false",
        "-cp", os.pathsep.join([target, stdlib_jar, junit, hamcrest]), "org.junit.runner.JUnitCore",
        *["com.unif.reactnativeumeng." + test.stem for test in sorted((root / "android/src/test/java/com/unif/reactnativeumeng").glob("*Test.kt"))],
    ])
    if result.returncode:
        raise SystemExit(result.returncode)
    for scenario in ["runtime", "terminal"]:
        subprocess.run([
            java, "-javaagent:" + str(agent) + "=destfile=" + str(coverage / "jacoco.exec") + ",append=true",
            "-cp", os.pathsep.join([target, stdlib_jar, junit, hamcrest]),
            "com.unif.reactnativeumeng.NativeHarnessKt", scenario,
        ], check=True)
    report_classes = Path(target) / "report-classes"
    report_classes.mkdir()
    class_root = Path(target) / "com/unif/reactnativeumeng"
    # Include every owned class, including sibling classes whose names differ from the source filename.
    # Boundary Codegen specs and test classes are compiled separately and identified by SourceFile.
    production_files = {source.name for source in production.glob("*.kt")}
    compiled_classes = sorted(class_root.glob("*.class"))
    info = subprocess.check_output([
        str(Path(java).with_name("javap")), "-verbose", *map(str, compiled_classes),
    ], text=True)
    for section in re.split(r"(?m)^Classfile ", info)[1:]:
        source = re.search(r'SourceFile: "([^"]+)"', section)
        if source and source.group(1) in production_files:
            compiled = Path(section.splitlines()[0])
            shutil.copy2(compiled, report_classes / compiled.name)
    subprocess.run([
        java, "-jar", str(cli), "report", str(coverage / "jacoco.exec"),
        "--classfiles", str(report_classes), "--sourcefiles", str(production),
        "--xml", str(coverage / "coverage.xml"), "--html", str(coverage / "html"),
    ], check=True)
    report = ET.parse(coverage / "coverage.xml").getroot()
    source_reports = report.findall(".//sourcefile")
    measured = {source.attrib["name"] for source in source_reports}
    if measured != production_files:
        raise SystemExit("Incomplete production source coverage: " + str(production_files ^ measured))
    counters = {counter.attrib["type"]: {
        "covered": int(counter.attrib["covered"]),
        "missed": int(counter.attrib["missed"]),
    } for counter in report.findall("counter")}
    scope = {
        "compiler": "Kotlin " + version,
        "instrumentation": "JaCoCo 0.8.13",
        "scope": "Every production Kotlin source under android/src/main/java/com/unif/reactnativeumeng",
        "counters": counters,
        "files": [{
            "path": str(source.relative_to(root)),
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        } for source in sorted(production.glob("*.kt"))],
    }
    (coverage / "scope.json").write_text(json.dumps(scope, indent=2) + "\n")
    for kind, counter in counters.items():
        print(kind, str(counter["covered"]) + "/" + str(counter["covered"] + counter["missed"]))
    if any(counter["missed"] for counter in counters.values()):
        raise SystemExit("Every owned native coverage counter must be 100%")
