import { spawnSync } from 'node:child_process';
import {
  appendFile,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

import {
  finalizeTempVerification,
  isDirectExecution,
} from './verification-utils.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const yarnBinary = resolve(repositoryRoot, '.yarn/releases/yarn-4.11.0.cjs');
const manifestContractFields = [
  'dependencies',
  'peerDependencies',
  'exports',
  'codegenConfig',
  'files',
  'react-native-builder-bob',
];
const publicContractFiles = [
  'src/index.ts',
  'src/mock.ts',
  'src/types.ts',
  'src/common.ts',
  'src/share.ts',
  'src/analytics.ts',
  'src/NativeUmengCommon.ts',
  'src/NativeUmengShare.ts',
  'src/NativeUmengAnalytics.ts',
  'src/ShareSheet/ShareSheetHost.tsx',
];
const initializationContractFiles = [
  'src/common.ts',
  'src/internal/initConfig.ts',
  'src/NativeUmengCommon.ts',
  'android/src/main/java/com/unif/reactnativeumeng/UmengBootstrap.kt',
  'android/src/main/java/com/unif/reactnativeumeng/UmengBootstrapAdapter.kt',
  'android/src/main/java/com/unif/reactnativeumeng/UmengCallbackComponents.kt',
  'android/src/main/java/com/unif/reactnativeumeng/UmengCommonModule.kt',
  'android/src/main/java/com/unif/reactnativeumeng/UmengNativeConfig.kt',
  'android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsAdapter.kt',
  'android/src/main/java/com/unif/reactnativeumeng/UmengShareAdapter.kt',
  'ios/UmengBootstrap.h',
  'ios/UmengBootstrap.mm',
  'ios/UmengCommon.mm',
  'ios/UmengSDKAdapters.h',
  'ios/UmengSDKAdapters.mm',
];
const nativeMetadataFiles = [
  'ReactNativeUmeng.podspec',
  'android/build.gradle',
  'android/src/main/AndroidManifest.xml',
  'android/consumer-rules.pro',
];
const unorderedManifestMapFields = new Set([
  'dependencies',
  'peerDependencies',
]);
const minorManifestContractFields = new Set([
  'peerDependencies',
  'exports',
  'codegenConfig',
]);
const minorContractFiles = new Set([
  ...publicContractFiles,
  ...initializationContractFiles,
]);
const initializationContractFileSet = new Set(initializationContractFiles);
const releaseIncrements = new Set(['auto', 'patch', 'minor', 'major']);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    maxBuffer: 30 * 1024 * 1024,
    ...options,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} exited with status ${result.status ?? 'unknown'}.`,
        result.error
          ? `spawn error:\n${result.error.stack ?? result.error.message}`
          : '',
        result.stdout ? `stdout:\n${result.stdout.trim()}` : '',
        result.stderr ? `stderr:\n${result.stderr.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout.trim();
}

function sortUnorderedMap(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    );
  }
  return value;
}

export function equalManifestContractField(field, left, right) {
  const normalize = unorderedManifestMapFields.has(field)
    ? sortUnorderedMap
    : (value) => value;

  return (
    JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
  );
}

export function isInitializationContractPath(relativePath) {
  if (initializationContractFileSet.has(relativePath)) {
    return true;
  }

  if (relativePath.startsWith('src/internal/')) {
    return true;
  }

  if (
    !relativePath.startsWith(
      'android/src/main/java/com/unif/reactnativeumeng/'
    ) &&
    !relativePath.startsWith('ios/')
  ) {
    return false;
  }

  const filename = relativePath.split('/').at(-1) ?? '';
  return /(bootstrap|common|config|initialization|initializer|init|consent|privacy|stateMachine)/i.test(
    filename
  );
}

export function minimumReleaseLevel({
  changedInitialization = [],
  changedManifestFields,
  changedNativeMetadata,
  publishedSourceChanges,
}) {
  const hasContractChange =
    changedInitialization.length > 0 ||
    changedManifestFields.length > 0 ||
    changedNativeMetadata.length > 0 ||
    publishedSourceChanges.length > 0;

  if (!hasContractChange) {
    return 'none';
  }

  if (
    changedInitialization.length > 0 ||
    changedManifestFields.some((field) =>
      minorManifestContractFields.has(field)
    ) ||
    publishedSourceChanges.some((relativePath) =>
      minorContractFiles.has(relativePath)
    )
  ) {
    return 'minor';
  }

  return 'patch';
}

export function selectReleaseVersion({
  automaticVersion,
  increment,
  tagVersion,
}) {
  if (!releaseIncrements.has(increment)) {
    throw new Error(
      `release increment must be one of auto, patch, minor, major; received ${increment}`
    );
  }

  const selectedVersion =
    increment === 'auto'
      ? automaticVersion
      : semver.inc(tagVersion, increment);

  if (!selectedVersion || !semver.valid(selectedVersion)) {
    throw new Error(
      `release increment ${increment} did not produce a semantic version`
    );
  }

  return selectedVersion;
}

export function parsePublishContractArgs(args) {
  let githubOutput;
  let increment = 'auto';

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (argument === '--increment') {
      if (!value) {
        throw new Error('--increment requires a value');
      }
      increment = value;
      index += 1;
      continue;
    }

    if (argument === '--github-output') {
      if (!value) {
        throw new Error('--github-output requires a path');
      }
      githubOutput = value;
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${argument}`);
  }

  return { githubOutput, increment };
}

function readAtTag(tag, relativePath) {
  const result = spawnSync('git', ['show', `${tag}:${relativePath}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status === 0) {
    return result.stdout;
  }
  if (result.status === 128) {
    return undefined;
  }

  throw new Error(
    `git show ${tag}:${relativePath} failed:\n${result.stderr || result.stdout}`
  );
}

async function currentFile(relativePath) {
  try {
    return await readFile(resolve(repositoryRoot, relativePath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

function canonicalMetadata(content) {
  if (content === undefined) {
    return undefined;
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith('#') &&
        !line.startsWith('//') &&
        !line.startsWith('<!--') &&
        !line.startsWith('-->')
    )
    .join('\n');
}

async function changedFilesSinceTag(tag, files, normalize = (value) => value) {
  const changes = [];
  for (const relativePath of files) {
    if (
      normalize(await currentFile(relativePath)) !==
      normalize(readAtTag(tag, relativePath))
    ) {
      changes.push(relativePath);
    }
  }
  return changes;
}

function changedPublishedSources(tag) {
  const output = run('git', [
    'diff',
    '--name-only',
    tag,
    '--',
    'src',
    'android/src/main',
    'ios',
    'ReactNativeUmeng.podspec',
  ]);
  return output
    ? output
        .split('\n')
        .filter(Boolean)
        .filter(
          (relativePath) =>
            !/(^|\/)__(tests|fixtures|mocks)__(\/|$)/.test(relativePath)
        )
    : [];
}

function parseVersionOutput(output) {
  const candidates = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => semver.valid(line));

  if (candidates.length !== 1) {
    throw new Error(
      `release-it --release-version must print one semantic version, received:\n${output}`
    );
  }
  return candidates[0];
}

async function conventionalVersion(manifest) {
  const tempDir = await mkdtemp(join(tmpdir(), 'umeng-release-version-'));
  const configPath = join(tempDir, 'release-it.json');
  let primaryError;
  let version;

  try {
    const statusBefore = run('git', [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]);
    const config = {
      git: false,
      npm: {
        publish: false,
      },
      github: false,
      plugins: manifest['release-it']?.plugins ?? {},
    };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const output = run(process.execPath, [
      yarnBinary,
      'release-it',
      '--release-version',
      '--config',
      configPath,
    ]);
    const statusAfter = run('git', [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]);

    if (statusAfter !== statusBefore) {
      throw new Error(
        [
          'release-it --release-version changed the working tree.',
          `before:\n${statusBefore || '(clean)'}`,
          `after:\n${statusAfter || '(clean)'}`,
        ].join('\n')
      );
    }

    version = parseVersionOutput(output);
  } catch (error) {
    primaryError = error;
  }

  await finalizeTempVerification({
    primaryError,
    stage: 'compute release version',
    tempPath: tempDir,
  });

  return version;
}

async function main() {
  const { githubOutput, increment } = parsePublishContractArgs(
    process.argv.slice(2)
  );
  const latestTag = run('git', ['describe', '--tags', '--abbrev=0']);
  const tagVersion = semver.valid(latestTag.replace(/^v/, ''));
  if (!tagVersion) {
    throw new Error(`latest tag is not a semantic version: ${latestTag}`);
  }

  const manifest = JSON.parse(
    await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
  );
  const taggedManifestText = readAtTag(latestTag, 'package.json');
  if (!taggedManifestText) {
    throw new Error(`${latestTag} does not contain package.json`);
  }
  const taggedManifest = JSON.parse(taggedManifestText);

  if (taggedManifest.version !== tagVersion) {
    throw new Error(
      `latest tag and tagged package disagree: tag=${latestTag}, tagged package=${taggedManifest.version}`
    );
  }

  if (manifest.version !== tagVersion) {
    throw new Error(
      `package version must remain at latest tag before release: tag=${latestTag}, package=${manifest.version}`
    );
  }

  const changedManifestFields = manifestContractFields.filter(
    (field) =>
      !equalManifestContractField(
        field,
        taggedManifest[field],
        manifest[field]
      )
  );
  const changedNativeMetadata = await changedFilesSinceTag(
    latestTag,
    nativeMetadataFiles,
    canonicalMetadata
  );
  const changedPublicContract = await changedFilesSinceTag(
    latestTag,
    publicContractFiles
  );
  const publishedSourceChanges = changedPublishedSources(latestTag);
  const changedInitialization = publishedSourceChanges.filter(
    isInitializationContractPath
  );

  const changeCategories = [];
  if (changedManifestFields.length > 0) {
    changeCategories.push(`manifest:${changedManifestFields.join(',')}`);
  }
  if (changedNativeMetadata.length > 0) {
    changeCategories.push(`native-metadata:${changedNativeMetadata.join(',')}`);
  }
  if (publishedSourceChanges.length > 0) {
    changeCategories.push(
      `published-source:${publishedSourceChanges.length} files`
    );
  }
  if (changedPublicContract.length > 0) {
    changeCategories.push(
      `public-api/type/native-spec:${changedPublicContract.join(',')}`
    );
  }
  if (changedInitialization.length > 0) {
    changeCategories.push(`initialization:${changedInitialization.join(',')}`);
  }

  const currentPodspec = await currentFile('ReactNativeUmeng.podspec');
  if (!/:tag\s*=>\s*"v#\{s\.version\}"/.test(currentPodspec ?? '')) {
    throw new Error(
      'ReactNativeUmeng.podspec source tag must be exactly v#{s.version}'
    );
  }

  const automaticVersion =
    increment === 'auto' ? await conventionalVersion(manifest) : undefined;
  const computedVersion = selectReleaseVersion({
    automaticVersion,
    increment,
    tagVersion,
  });
  const hasContractChange = changeCategories.length > 0;
  const minimumLevel = minimumReleaseLevel({
    changedInitialization,
    changedManifestFields,
    changedNativeMetadata,
    publishedSourceChanges,
  });
  const minimumRelease =
    minimumLevel === 'none'
      ? tagVersion
      : semver.inc(tagVersion, minimumLevel);

  if (
    hasContractChange &&
    (!semver.gt(computedVersion, tagVersion) ||
      semver.lt(computedVersion, minimumRelease))
  ) {
    throw new Error(
      [
        'Publish contract version verification failed.',
        `tag: ${latestTag}`,
        `package version: ${manifest.version}`,
        `computed version: ${computedVersion}`,
        `changes: ${changeCategories.join(' | ')}`,
        `minimum required: ${minimumLevel} (${minimumRelease})`,
      ].join('\n')
    );
  }

  const successMessage = [
    'Publish contract verification passed.',
    `tag=${latestTag}`,
    `package=${manifest.version}`,
    `increment=${increment}`,
    `computed=${computedVersion}`,
    `minimum=${minimumLevel} (${minimumRelease})`,
    `changes=${changeCategories.join(' | ') || 'none'}`,
  ].join(' ');

  if (githubOutput) {
    await appendFile(githubOutput, `version=${computedVersion}\n`);
  }

  console.log(
    [
      successMessage,
      githubOutput ? `github-output=${githubOutput}` : '',
    ]
      .filter(Boolean)
      .join(' ')
  );
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
