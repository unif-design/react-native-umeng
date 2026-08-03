import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  finalizeTempVerification,
  isDirectExecution,
} from './verification-utils.mjs';

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
  'ReactNativeUmeng.podspec',
];
const podspecIOSSourceGlob = 'ios/**/*.{h,m,mm,swift,cpp}';
const podspecIOSSourceExtensions = new Set([
  '.h',
  '.m',
  '.mm',
  '.swift',
  '.cpp',
]);

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

async function listFilesRecursively(directory, root) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absolutePath, root)));
    } else if (entry.isFile()) {
      files.push(relative(root, absolutePath).split(sep).join('/'));
    }
  }

  return files;
}

export async function collectProductionNativeFiles(root = repositoryRoot) {
  const podspec = await readFile(
    resolve(root, 'ReactNativeUmeng.podspec'),
    'utf8'
  );
  const escapedGlob = podspecIOSSourceGlob.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
  if (
    !new RegExp(
      `s\\.source_files\\s*=\\s*["']${escapedGlob}["']`
    ).test(podspec)
  ) {
    throw new Error(
      `ReactNativeUmeng.podspec must declare source_files as ${podspecIOSSourceGlob}`
    );
  }

  const androidFiles = await listFilesRecursively(
    resolve(root, 'android/src/main'),
    root
  );
  const consumerRules = 'android/consumer-rules.pro';
  await stat(resolve(root, consumerRules));

  const iosFiles = (
    await listFilesRecursively(resolve(root, 'ios'), root)
  ).filter((relativePath) =>
    podspecIOSSourceExtensions.has(extname(relativePath))
  );

  return [...androidFiles, consumerRules, ...iosFiles].sort();
}

export function assertProductionNativeFiles(packageFiles, expectedFiles) {
  const missing = expectedFiles.filter(
    (relativePath) => !packageFiles.has(relativePath)
  );

  if (missing.length > 0) {
    throw new Error(
      missing
        .map(
          (relativePath) =>
            `tarball is missing production native file: ${relativePath}`
        )
        .join('\n')
    );
  }
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
  let currentStage = 'run npm pack';
  let primaryError;
  let successMessage;

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

    currentStage = 'verify package.json files entries';
    await verifyLiteralFileEntries(manifest, failures);

    currentStage = 'enumerate production native files';
    const productionNativeFiles =
      await collectProductionNativeFiles(repositoryRoot);
    try {
      assertProductionNativeFiles(packageFiles, productionNativeFiles);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }

    currentStage = 'verify required and forbidden tarball files';
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

    successMessage = `Package verification passed (${packageFiles.size} files, ${productionNativeFiles.length} production native files, npm cache: isolated temp).`;
  } catch (error) {
    primaryError = error;
  }

  await finalizeTempVerification({
    primaryError,
    stage: currentStage,
    successMessage,
    tempPath: npmCache,
  });
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
