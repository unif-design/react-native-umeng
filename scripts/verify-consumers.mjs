import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

let currentStage = 'create fixture';

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
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
    writeFile(
      join(fixtureDir, 'entry-root.js'),
      "import '@unif/react-native-umeng';\n"
    ),
    writeFile(
      join(fixtureDir, 'entry-source.js'),
      "import '@unif/react-native-umeng';\n"
    ),
    writeFile(
      join(fixtureDir, 'entry-lib.js'),
      "import './node_modules/@unif/react-native-umeng/lib/module/index.js';\n"
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

async function bundle(name, entry, conditionNames) {
  const config = mergeConfig(getDefaultConfig(projectRoot), {
    projectRoot,
    // Metro CLI 的 loadConfig 也会把 projectRoot 加入 watchFolders；直接调用
    // runBuild 时显式补同一规则，且只允许观察系统 temp 内的 consumer fixture。
    watchFolders: [projectRoot],
    resolver: {
      useWatchman: false,
      unstable_enablePackageExports: true,
      ...(conditionNames ? { unstable_conditionNames: conditionNames } : {}),
    },
  });

  await metro.runBuild(config, {
    dev: false,
    entry: path.join(projectRoot, entry),
    minify: false,
    out: path.join(artifactsDir, \`\${name}.jsbundle\`),
    platform: 'ios',
    sourceMap: false,
  });
}

(async () => {
  await bundle('package-root', 'entry-root.js');
  await bundle('source-condition', 'entry-source.js', [
    'source',
    'react-native',
    'require',
  ]);
  await bundle('lib-module', 'entry-lib.js');
  console.log('Metro consumer smoke passed: root, source condition, lib/module.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`
    ),
    writeFile(
      join(fixtureDir, 'jest.config.cjs'),
      `const reactNativePreset = require('@react-native/jest-preset');
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
  testEnvironmentOptions: {
    customExportConditions: ['source'],
  },
  transformIgnorePatterns: [
    umengTransformIgnorePattern,
    ...remainingTransformIgnorePatterns,
  ],
};\n`
    ),
    writeFile(
      join(fixtureDir, 'mock.test.js'),
      `const {
  Platform,
  Share,
  shareCancel,
  shareFailed,
} = require('@unif/react-native-umeng/mock');

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
  let completed = false;

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

    currentStage = 'bundle root, source, and lib/module entries';
    runCommand(process.execPath, ['metro-smoke.cjs'], fixtureDir);

    currentStage = 'run isolated mock Jest tests';
    runCommand(
      process.execPath,
      [
        yarnBinary,
        'jest',
        '--config',
        'jest.config.cjs',
        '--runInBand',
        'mock.test.js',
      ],
      fixtureDir
    );

    completed = true;
    console.log(
      'Consumer verification passed (isolated install, three Metro entries, official mock Jest).'
    );
  } catch (error) {
    console.error(
      `Consumer verification failed during "${currentStage}". Fixture preserved at:\n${fixtureDir}`
    );
    throw error;
  } finally {
    if (completed) {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
