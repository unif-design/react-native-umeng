import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

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
  'android/src/main/java/com/unif/reactnativeumeng/UmengCommonModule.kt',
  'ios/UmengBootstrap.h',
  'ios/UmengBootstrap.mm',
  'ios/UmengCommon.mm',
];
const nativeMetadataFiles = [
  'ReactNativeUmeng.podspec',
  'android/build.gradle',
  'android/src/main/AndroidManifest.xml',
  'android/consumer-rules.pro',
];

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

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function equalContractValue(left, right) {
  return (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
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
  const statusBefore = run('git', [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);

  try {
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

    return parseVersionOutput(output);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
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
    (field) => !equalContractValue(taggedManifest[field], manifest[field])
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
  const changedInitialization = await changedFilesSinceTag(
    latestTag,
    initializationContractFiles
  );
  const publishedSourceChanges = changedPublishedSources(latestTag);

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

  const computedVersion = await conventionalVersion(manifest);
  const hasContractChange = changeCategories.length > 0;
  let minimumRelease = tagVersion;
  let minimumLevel = 'none';

  if (hasContractChange) {
    minimumLevel = 'patch';
    minimumRelease = semver.inc(tagVersion, 'patch');
  }

  if (
    changedManifestFields.includes('peerDependencies') ||
    changedPublicContract.length > 0 ||
    changedInitialization.length > 0
  ) {
    minimumLevel = 'minor';
    minimumRelease = semver.inc(tagVersion, 'minor');
  }

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

  console.log(
    [
      'Publish contract verification passed.',
      `tag=${latestTag}`,
      `package=${manifest.version}`,
      `computed=${computedVersion}`,
      `minimum=${minimumLevel} (${minimumRelease})`,
      `changes=${changeCategories.join(' | ') || 'none'}`,
    ].join(' ')
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
