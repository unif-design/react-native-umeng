import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  finalizeTempVerification,
  isDirectExecution,
} from './verification-utils.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const yarnBinary = resolve(repositoryRoot, '.yarn/releases/yarn-4.11.0.cjs');
const smokeToolNames = [
  '@babel/core',
  '@react-native/babel-preset',
  '@react-native/jest-preset',
  '@react-native/metro-config',
  'jest',
  'semver',
];
export const consumerSmokeCases = [
  {
    conditionNames: undefined,
    entry: 'entry-root-default.js',
    expectedPackagePath: 'lib/module/index.js',
    name: 'package-root-default',
    specifier: '@unif/react-native-umeng',
  },
  {
    conditionNames: ['source', 'react-native'],
    entry: 'entry-root-source.js',
    expectedPackagePath: 'src/index.ts',
    name: 'package-root-source',
    specifier: '@unif/react-native-umeng',
  },
  {
    conditionNames: undefined,
    entry: 'entry-mock-default.js',
    expectedPackagePath: 'lib/module/mock.js',
    name: 'package-mock-default',
    specifier: '@unif/react-native-umeng/mock',
  },
  {
    conditionNames: ['source', 'react-native'],
    entry: 'entry-mock-source.js',
    expectedPackagePath: 'src/mock.ts',
    name: 'package-mock-source',
    specifier: '@unif/react-native-umeng/mock',
  },
];
export const mockJestSmokeCases = [
  {
    config: 'jest.default.config.cjs',
    expectedPackagePath: 'lib/module/mock.js',
    name: 'default',
  },
  {
    config: 'jest.source.config.cjs',
    expectedPackagePath: 'src/mock.ts',
    name: 'source',
  },
];

let currentStage = 'create fixture';

function isInside(root, candidate) {
  const relativePath = relative(root, candidate);
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  );
}

export function assertResolvedTarget({
  expectedPackagePath,
  fixtureRoot,
  packageRoot,
  resolvedPath,
  smokeName,
}) {
  const absoluteFixtureRoot = resolve(fixtureRoot);
  const absolutePackageRoot = resolve(packageRoot);
  const absoluteResolvedPath = resolve(resolvedPath);

  if (!isInside(absoluteFixtureRoot, absolutePackageRoot)) {
    throw new Error(
      `${smokeName} package root is outside isolated fixture: ${absolutePackageRoot}`
    );
  }
  if (!isInside(absoluteFixtureRoot, absoluteResolvedPath)) {
    throw new Error(
      `${smokeName} resolved outside isolated fixture: ${absoluteResolvedPath}`
    );
  }

  const expectedPath = resolve(absolutePackageRoot, expectedPackagePath);
  if (absoluteResolvedPath !== expectedPath) {
    throw new Error(
      `${smokeName} expected ${expectedPath}, resolved ${absoluteResolvedPath}`
    );
  }
}

function runCommand(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv,
      CI: '1',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    maxBuffer: 100 * 1024 * 1024,
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

  return result;
}

function createJestConfig(customExportConditions) {
  const environmentOptions = customExportConditions
    ? `  testEnvironmentOptions: {
    customExportConditions: ${JSON.stringify(customExportConditions)},
  },
`
    : '';

  return `const reactNativePreset = require('@react-native/jest-preset');
const [baseTransformIgnorePattern, ...remainingTransformIgnorePatterns] =
  reactNativePreset.transformIgnorePatterns;
const insertionPoint = baseTransformIgnorePattern.lastIndexOf(')/)');

if (insertionPoint < 0) {
  throw new Error(
    \`Cannot extend React Native transform allowlist: \${baseTransformIgnorePattern}\`
  );
}

const umengTransformIgnorePattern =
  baseTransformIgnorePattern.slice(0, insertionPoint) +
  '|@unif/react-native-umeng' +
  baseTransformIgnorePattern.slice(insertionPoint);

module.exports = {
  preset: '@react-native/jest-preset',
  testEnvironment: 'node',
${environmentOptions}  transformIgnorePatterns: [
    umengTransformIgnorePattern,
    ...remainingTransformIgnorePatterns,
  ],
};
`;
}

async function writeFixtureFiles(fixtureDir, rootManifest, tarballFilename) {
  const dependencies = {
    '@unif/react-native-umeng': `file:./${tarballFilename}`,
  };

  for (const [peerName] of Object.entries(
    rootManifest.peerDependencies ?? {}
  )) {
    const version = rootManifest.devDependencies?.[peerName];
    if (typeof version !== 'string') {
      throw new Error(
        `package.json#devDependencies must provide the consumer version for peer ${peerName}`
      );
    }
    dependencies[peerName] = version;
  }

  for (const toolName of smokeToolNames) {
    const version = rootManifest.devDependencies?.[toolName];
    if (typeof version !== 'string') {
      throw new Error(
        `package.json#devDependencies must provide the smoke tool version for ${toolName}`
      );
    }
    dependencies[toolName] = version;
  }

  const fixtureManifest = {
    name: 'react-native-umeng-consumer-smoke',
    version: '0.0.0',
    private: true,
    packageManager: 'yarn@4.11.0',
    dependencies,
  };

  await Promise.all([
    writeFile(
      join(fixtureDir, 'package.json'),
      `${JSON.stringify(fixtureManifest, null, 2)}\n`
    ),
    writeFile(join(fixtureDir, '.yarnrc.yml'), 'nodeLinker: node-modules\n'),
    writeFile(
      join(fixtureDir, 'babel.config.cjs'),
      "module.exports = { presets: ['module:@react-native/babel-preset'] };\n"
    ),
    ...consumerSmokeCases.map(({ entry, specifier }) =>
      writeFile(join(fixtureDir, entry), `import '${specifier}';\n`)
    ),
    writeFile(
      join(fixtureDir, 'verify-install.cjs'),
      `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const semver = require('semver');

const fixtureRoot = fs.realpathSync(__dirname);
const fixtureNodeModules = fs.realpathSync(path.join(fixtureRoot, 'node_modules'));
const packageJsonPath = fs.realpathSync(
  require.resolve('@unif/react-native-umeng/package.json')
);
const resolvedRelativePath = path.relative(fixtureNodeModules, packageJsonPath);

if (
  resolvedRelativePath === '..' ||
  resolvedRelativePath.startsWith(\`..\${path.sep}\`) ||
  path.isAbsolute(resolvedRelativePath)
) {
  throw new Error(
    \`package resolved outside fixture node_modules: \${packageJsonPath}\`
  );
}

const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
for (const [peerName, peerRange] of Object.entries(manifest.peerDependencies ?? {})) {
  const peerManifestPath = path.join(
    fixtureNodeModules,
    ...peerName.split('/'),
    'package.json'
  );
  const peerManifest = JSON.parse(fs.readFileSync(peerManifestPath, 'utf8'));
  if (!semver.satisfies(peerManifest.version, peerRange, { includePrerelease: true })) {
    throw new Error(
      \`\${peerName}@\${peerManifest.version} does not satisfy \${peerRange}\`
    );
  }
}

console.log(\`Consumer install resolved from fixture: \${packageJsonPath}\`);
`
    ),
    writeFile(
      join(fixtureDir, 'metro-smoke.cjs'),
      `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const metroConfigPackage = require.resolve('@react-native/metro-config/package.json');
const metro = require(
  require.resolve('metro', { paths: [path.dirname(metroConfigPackage)] })
);
const projectRoot = fs.realpathSync(__dirname);
const artifactsDir = path.join(projectRoot, 'artifacts');
const fixtureNodeModules = fs.realpathSync(path.join(projectRoot, 'node_modules'));
const packageRoot = fs.realpathSync(
  path.join(fixtureNodeModules, '@unif', 'react-native-umeng')
);
const smokeCases = ${JSON.stringify(consumerSmokeCases)};

function isInside(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return (
    relativePath === '' ||
    (
      relativePath !== '..' &&
      !relativePath.startsWith(\`..\${path.sep}\`) &&
      !path.isAbsolute(relativePath)
    )
  );
}

async function bundle(smoke) {
  let resolvedTarget;
  const config = mergeConfig(getDefaultConfig(projectRoot), {
    projectRoot,
    // Metro CLI 的 loadConfig 也会把 projectRoot 加入 watchFolders；直接调用
    // runBuild 时显式补同一规则，且只允许观察系统 temp 内的 consumer fixture。
    watchFolders: [projectRoot],
    resolver: {
      disableHierarchicalLookup: true,
      extraNodeModules: {},
      nodeModulesPaths: [fixtureNodeModules],
      useWatchman: false,
      unstable_enablePackageExports: true,
      ...(smoke.conditionNames
        ? { unstable_conditionNames: smoke.conditionNames }
        : {}),
      resolveRequest(context, moduleName, platform) {
        const resolution = context.resolveRequest(
          context,
          moduleName,
          platform
        );

        if (resolution.type === 'sourceFile') {
          const resolvedPath = fs.realpathSync(resolution.filePath);
          if (!isInside(projectRoot, resolvedPath)) {
            throw new Error(
              \`\${smoke.name} resolved \${moduleName} outside isolated fixture: \${resolvedPath}\`
            );
          }
          if (moduleName === smoke.specifier) {
            resolvedTarget = resolvedPath;
          }
        }

        return resolution;
      },
    },
  });

  await metro.runBuild(config, {
    dev: false,
    entry: path.join(projectRoot, smoke.entry),
    minify: false,
    out: path.join(artifactsDir, \`\${smoke.name}.jsbundle\`),
    platform: 'ios',
    sourceMap: false,
  });

  if (!resolvedTarget) {
    throw new Error(
      \`\${smoke.name} did not resolve \${smoke.specifier}\`
    );
  }

  const expectedTarget = fs.realpathSync(
    path.join(packageRoot, smoke.expectedPackagePath)
  );
  if (resolvedTarget !== expectedTarget) {
    throw new Error(
      \`\${smoke.name} expected \${expectedTarget}, resolved \${resolvedTarget}\`
    );
  }

  console.log(
    \`\${smoke.name}: \${path.relative(projectRoot, resolvedTarget)}\`
  );
}

(async () => {
  for (const smoke of smokeCases) {
    await bundle(smoke);
  }
  console.log('Metro consumer smoke passed: default/source package root and mock.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`
    ),
    writeFile(
      join(fixtureDir, 'jest.default.config.cjs'),
      createJestConfig()
    ),
    writeFile(
      join(fixtureDir, 'jest.source.config.cjs'),
      createJestConfig(['source'])
    ),
    writeFile(
      join(fixtureDir, 'mock.test.js'),
      `const fs = require('node:fs');
const path = require('node:path');

const expectedPackagePath = process.env.EXPECTED_MOCK_PACKAGE_PATH;
if (!expectedPackagePath) {
  throw new Error('EXPECTED_MOCK_PACKAGE_PATH is required');
}

const resolvedMockPath = fs.realpathSync(
  require.resolve('@unif/react-native-umeng/mock')
);
const expectedMockPath = fs.realpathSync(
  path.join(
    __dirname,
    'node_modules',
    '@unif',
    'react-native-umeng',
    expectedPackagePath
  )
);

const {
  Platform,
  Share,
  shareCancel,
  shareFailed,
} = require('@unif/react-native-umeng/mock');

test('official mock resolves to the selected tarball export', () => {
  expect(resolvedMockPath).toBe(expectedMockPath);
});

test('official mock resolves successful shares', async () => {
  await expect(
    Share.shareText({
      platform: Platform.WECHAT_SESSION,
      text: 'hello',
    })
  ).resolves.toEqual({
    code: 'success',
    platform: Platform.WECHAT_SESSION,
  });
});

test('official mock rejects cancellation with E_USER_CANCEL', async () => {
  Share.shareText.mockRejectedValueOnce(
    shareCancel(Platform.WECHAT_SESSION)
  );

  await expect(
    Share.shareText({
      platform: Platform.WECHAT_SESSION,
      text: 'hello',
    })
  ).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
});

test('official mock rejects failure with E_SHARE_FAILED', async () => {
  Share.shareText.mockRejectedValueOnce(
    shareFailed(Platform.WECHAT_SESSION, 'network error')
  );

  await expect(
    Share.shareText({
      platform: Platform.WECHAT_SESSION,
      text: 'hello',
    })
  ).rejects.toMatchObject({
    code: 'E_SHARE_FAILED',
    message: 'network error',
  });
});
`
    ),
  ]);
}

async function main() {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'umeng-consumer-'));
  let primaryError;
  let successMessage;

  try {
    const rootManifest = JSON.parse(
      await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')
    );

    currentStage = 'prepare package';
    runCommand(process.execPath, [yarnBinary, 'prepare'], repositoryRoot);

    currentStage = 'pack tarball';
    const packResult = runCommand(
      'npm',
      [
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        fixtureDir,
        '--cache',
        join(fixtureDir, '.npm-cache'),
      ],
      repositoryRoot
    );
    let packReports;
    try {
      packReports = JSON.parse(packResult.stdout);
    } catch (error) {
      throw new Error(
        `npm pack returned invalid JSON: ${error.message}\nstdout:\n${packResult.stdout}\nstderr:\n${packResult.stderr}`
      );
    }
    const tarballFilename = packReports?.[0]?.filename;
    if (typeof tarballFilename !== 'string' || tarballFilename.length === 0) {
      throw new Error(
        `npm pack did not return a filename: ${packResult.stdout}`
      );
    }

    currentStage = 'write isolated fixture';
    await writeFixtureFiles(fixtureDir, rootManifest, tarballFilename);
    await mkdir(join(fixtureDir, 'artifacts'));

    currentStage = 'install tarball and peers';
    runCommand(
      process.execPath,
      [yarnBinary, 'install', '--no-immutable'],
      fixtureDir
    );

    currentStage = 'verify isolated resolution and peers';
    runCommand(process.execPath, ['verify-install.cjs'], fixtureDir);

    const resolvedPackageRoot = await realpath(
      join(
        fixtureDir,
        'node_modules',
        '@unif',
        'react-native-umeng',
        'package.json'
      )
    );
    const canonicalRepositoryRoot = await realpath(repositoryRoot);
    const repositoryRelative = relative(
      canonicalRepositoryRoot,
      resolvedPackageRoot
    );
    if (
      repositoryRelative === '' ||
      (repositoryRelative !== '..' &&
        !repositoryRelative.startsWith(`..${sep}`) &&
        !isAbsolute(repositoryRelative))
    ) {
      throw new Error(
        `consumer package unexpectedly resolves inside repository: ${resolvedPackageRoot}`
      );
    }

    currentStage = 'bundle and assert default/source root and mock entries';
    runCommand(process.execPath, ['metro-smoke.cjs'], fixtureDir);

    for (const smoke of mockJestSmokeCases) {
      currentStage = `run isolated ${smoke.name} mock Jest test`;
      runCommand(
        process.execPath,
        [
          yarnBinary,
          'jest',
          '--config',
          smoke.config,
          '--runInBand',
          'mock.test.js',
        ],
        fixtureDir,
        {
          EXPECTED_MOCK_PACKAGE_PATH: smoke.expectedPackagePath,
        }
      );
    }

    successMessage =
      'Consumer verification passed (isolated install, exact default/source root and mock Metro targets, independent default/source official mock Jest).';
  } catch (error) {
    primaryError = error;
  }

  await finalizeTempVerification({
    preserveOnFailure: Boolean(primaryError),
    primaryError,
    stage: currentStage,
    successMessage,
    tempPath: fixtureDir,
  });
}

if (isDirectExecution(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
