import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'src/index.ts',
  'src/mock.ts',
  'lib/module/index.js',
  'lib/module/mock.js',
  'lib/typescript/src/index.d.ts',
  'lib/typescript/src/mock.d.ts',
  'android/build.gradle',
  'android/src/main/AndroidManifest.xml',
  'ios/UmengBootstrap.h',
  'ios/UmengCommon.mm',
  'ReactNativeUmeng.podspec',
];

function formatProcessFailure(result) {
  return [
    `npm pack exited with status ${result.status ?? 'unknown'}.`,
    result.error
      ? `spawn error:\n${result.error.stack ?? result.error.message}`
      : '',
    result.stdout ? `stdout:\n${result.stdout.trim()}` : '',
    result.stderr ? `stderr:\n${result.stderr.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function hasGlob(value) {
  return /[*?[\]{}()]/.test(value);
}

function forbiddenReason(packagePath) {
  const segments = packagePath
    .split('/')
    .map((segment) => segment.toLowerCase());

  if (
    segments.some((segment) =>
      [
        '__tests__',
        '__fixtures__',
        '__mocks__',
        'test',
        'tests',
        'pods',
        'build',
        '.gradle',
        'gradle',
      ].includes(segment)
    )
  ) {
    return 'test/build/Pods/Gradle cache or wrapper content';
  }

  if (
    /(^|\/)gradlew(\.bat)?$/i.test(packagePath) ||
    /(^|\/)local\.properties$/i.test(packagePath) ||
    /(^|\/)\.ds_store$/i.test(packagePath)
  ) {
    return 'local or Gradle wrapper content';
  }

  return undefined;
}

async function verifyLiteralFileEntries(manifest, failures) {
  for (const entry of manifest.files ?? []) {
    if (typeof entry !== 'string' || entry.startsWith('!') || hasGlob(entry)) {
      continue;
    }

    try {
      await stat(resolve(repositoryRoot, entry));
    } catch {
      failures.push(`package.json#files literal path does not exist: ${entry}`);
    }
  }
}

async function main() {
  const manifest = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
  );
  const npmCache = await mkdtemp(join(tmpdir(), 'umeng-pack-cache-'));

  try {
    const result = spawnSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts', '--cache', npmCache],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    if (result.error || result.status !== 0) {
      throw new Error(formatProcessFailure(result));
    }

    let reports;
    try {
      reports = JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(
        `npm pack returned invalid JSON: ${error.message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );
    }

    if (!Array.isArray(reports) || reports.length !== 1) {
      throw new Error(
        `npm pack must return exactly one report, received ${JSON.stringify(reports)}`
      );
    }

    const packageFiles = new Set(
      (reports[0].files ?? []).map(({ path }) => path)
    );
    const failures = [];

    await verifyLiteralFileEntries(manifest, failures);

    for (const requiredFile of requiredFiles) {
      if (!packageFiles.has(requiredFile)) {
        failures.push(`tarball is missing required file: ${requiredFile}`);
      }
    }

    for (const packagePath of packageFiles) {
      const reason = forbiddenReason(packagePath);
      if (reason) {
        failures.push(`tarball contains forbidden ${reason}: ${packagePath}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Package verification failed (${failures.length}):\n${failures
          .map((failure) => `- ${failure}`)
          .join('\n')}`
      );
    }

    console.log(
      `Package verification passed (${packageFiles.size} files, npm cache: isolated temp).`
    );
  } finally {
    await rm(npmCache, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
