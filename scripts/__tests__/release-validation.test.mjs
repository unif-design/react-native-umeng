import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  equalManifestContractField,
  isInitializationContractPath,
  minimumReleaseLevel,
  parsePublishContractArgs,
  selectReleaseVersion,
} from '../verify-publish-contract.mjs';
import {
  assertSharedDependencyRanges,
  sharedDependencyRanges,
} from '../dependency-contract.mjs';
import {
  assertProductionNativeFiles,
  collectProductionNativeFiles,
} from '../verify-package.mjs';
import {
  assertResolvedTarget,
  consumerSmokeCases,
  mockJestSmokeCases,
} from '../verify-consumers.mjs';
import { finalizeTempVerification } from '../verification-utils.mjs';

test('conditional export reorder is a contract mutation', () => {
  const before = {
    '.': {
      source: './src/index.ts',
      default: './lib/module/index.js',
    },
  };
  const after = {
    '.': {
      default: './lib/module/index.js',
      source: './src/index.ts',
    },
  };

  assert.equal(equalManifestContractField('exports', before, after), false);
  assert.equal(
    equalManifestContractField(
      'dependencies',
      { alpha: '^1.0.0', beta: '^2.0.0' },
      { beta: '^2.0.0', alpha: '^1.0.0' }
    ),
    true
  );
});

test('mock-only and native adapter-only changes require a minor release', () => {
  const minorPaths = [
    'src/mock.ts',
    'android/src/main/java/com/unif/reactnativeumeng/UmengBootstrapAdapter.kt',
    'android/src/main/java/com/unif/reactnativeumeng/UmengNativeConfig.kt',
    'android/src/main/java/com/unif/reactnativeumeng/UmengCallbackComponents.kt',
    'ios/UmengSDKAdapters.h',
    'ios/UmengSDKAdapters.mm',
  ];

  for (const relativePath of minorPaths) {
    assert.equal(
      minimumReleaseLevel({
        changedManifestFields: [],
        changedNativeMetadata: [],
        publishedSourceChanges: [relativePath],
      }),
      'minor',
      relativePath
    );
  }

  for (const manifestField of ['exports', 'codegenConfig']) {
    assert.equal(
      minimumReleaseLevel({
        changedManifestFields: [manifestField],
        changedNativeMetadata: [],
        publishedSourceChanges: [],
      }),
      'minor',
      manifestField
    );
  }
});

test('new initialization helpers cannot bypass the minor release gate', () => {
  const initializationPaths = [
    'src/internal/newInitializationState.ts',
    'android/src/main/java/com/unif/reactnativeumeng/UmengInitializationState.kt',
    'ios/UmengInitializationState.mm',
  ];

  for (const relativePath of initializationPaths) {
    assert.equal(isInitializationContractPath(relativePath), true, relativePath);
    assert.equal(
      minimumReleaseLevel({
        changedInitialization: [relativePath],
        changedManifestFields: [],
        changedNativeMetadata: [],
        publishedSourceChanges: [relativePath],
      }),
      'minor',
      relativePath
    );
  }

  assert.equal(
    isInitializationContractPath(
      'src/ShareSheet/ShareSheetController.ts'
    ),
    false
  );
});

test('shared Design runtime ranges must remain exact in every manifest', () => {
  const manifest = {
    dependencies: { ...sharedDependencyRanges },
  };
  assert.doesNotThrow(() =>
    assertSharedDependencyRanges(
      manifest,
      'dependencies',
      'fixture/package.json'
    )
  );

  manifest.dependencies['react-native-worklets'] = '^0.12.0';
  assert.throws(
    () =>
      assertSharedDependencyRanges(
        manifest,
        'dependencies',
        'fixture/package.json'
      ),
    /react-native-worklets.*\^0\.11\.3/
  );
});

test('website validation runs the cross-workspace dependency verifier', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/project-validation.yml', import.meta.url),
    'utf8'
  );
  const websiteJob = workflow
    .split(/^  website:/m)[1]
    ?.split(/^  instructions:/m)[0];

  assert.match(websiteJob ?? '', /yarn verify:dependencies/);
});

test('explicit release increment selects an exact version for validation and release', () => {
  assert.deepEqual(
    parsePublishContractArgs([
      '--increment',
      'minor',
      '--github-output',
      '/tmp/github-output',
    ]),
    {
      githubOutput: '/tmp/github-output',
      increment: 'minor',
    }
  );
  assert.equal(
    selectReleaseVersion({
      automaticVersion: '1.2.4',
      increment: 'auto',
      tagVersion: '1.2.3',
    }),
    '1.2.4'
  );
  assert.equal(
    selectReleaseVersion({
      automaticVersion: '1.2.4',
      increment: 'minor',
      tagVersion: '1.2.3',
    }),
    '1.3.0'
  );
  assert.throws(
    () =>
      selectReleaseVersion({
        automaticVersion: '1.2.4',
        increment: 'invalid',
        tagVersion: '1.2.3',
      }),
    /auto, patch, minor, major/
  );
});

test('native package audit enumerates every Android main and Podspec iOS source', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'umeng-native-fixture-'));

  try {
    const fixtureFiles = {
      'ReactNativeUmeng.podspec':
        's.source_files = "ios/**/*.{h,m,mm,swift,cpp}"\n',
      'android/consumer-rules.pro': '-keep class example.** { *; }\n',
      'android/src/main/AndroidManifest.xml': '<manifest />\n',
      'android/src/main/java/example/Adapter.kt': 'class Adapter\n',
      'android/src/main/res/xml/provider.xml': '<paths />\n',
      'ios/Nested/Adapter.mm': '@interface Adapter\n@end\n',
      'ios/Public.h': '@interface Public\n@end\n',
      'ios/ignored.txt': 'not matched by the Podspec\n',
    };

    for (const [relativePath, content] of Object.entries(fixtureFiles)) {
      const absolutePath = join(fixtureRoot, relativePath);
      await mkdir(join(absolutePath, '..'), { recursive: true });
      await writeFile(absolutePath, content);
    }

    const expected = await collectProductionNativeFiles(fixtureRoot);
    assert.deepEqual(expected, [
      'android/consumer-rules.pro',
      'android/src/main/AndroidManifest.xml',
      'android/src/main/java/example/Adapter.kt',
      'android/src/main/res/xml/provider.xml',
      'ios/Nested/Adapter.mm',
      'ios/Public.h',
    ]);

    const mutatedTarball = new Set(
      expected.filter((relativePath) => relativePath !== 'ios/Nested/Adapter.mm')
    );
    assert.throws(
      () => assertProductionNativeFiles(mutatedTarball, expected),
      /tarball is missing production native file: ios\/Nested\/Adapter\.mm/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('consumer smoke matrix asserts default and source targets for root and mock', () => {
  assert.deepEqual(
    consumerSmokeCases.map(
      ({ conditionNames, expectedPackagePath, specifier }) => ({
        conditionNames,
        expectedPackagePath,
        specifier,
      })
    ),
    [
      {
        conditionNames: undefined,
        expectedPackagePath: 'lib/module/index.js',
        specifier: '@unif/react-native-umeng',
      },
      {
        conditionNames: ['source', 'react-native'],
        expectedPackagePath: 'src/index.ts',
        specifier: '@unif/react-native-umeng',
      },
      {
        conditionNames: undefined,
        expectedPackagePath: 'lib/module/mock.js',
        specifier: '@unif/react-native-umeng/mock',
      },
      {
        conditionNames: ['source', 'react-native'],
        expectedPackagePath: 'src/mock.ts',
        specifier: '@unif/react-native-umeng/mock',
      },
    ]
  );
  assert.deepEqual(mockJestSmokeCases, [
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
  ]);
});

test('consumer resolver rejects repository fallback and wrong export targets', () => {
  const fixtureRoot = '/tmp/isolated-consumer';
  const packageRoot =
    '/tmp/isolated-consumer/node_modules/@unif/react-native-umeng';

  assert.doesNotThrow(() =>
    assertResolvedTarget({
      expectedPackagePath: 'lib/module/index.js',
      fixtureRoot,
      packageRoot,
      resolvedPath: `${packageRoot}/lib/module/index.js`,
      smokeName: 'root-default',
    })
  );
  assert.throws(
    () =>
      assertResolvedTarget({
        expectedPackagePath: 'lib/module/index.js',
        fixtureRoot,
        packageRoot,
        resolvedPath: '/workspace/react-native-umeng/lib/module/index.js',
        smokeName: 'root-default',
      }),
    /outside isolated fixture/
  );
  assert.throws(
    () =>
      assertResolvedTarget({
        expectedPackagePath: 'src/index.ts',
        fixtureRoot,
        packageRoot,
        resolvedPath: `${packageRoot}/lib/module/index.js`,
        smokeName: 'root-source',
      }),
    /expected .*src\/index\.ts/
  );
});

test('cleanup failure keeps the primary error and suppresses PASS output', async () => {
  const primaryError = new Error('primary verification failure');
  const messages = [];

  await assert.rejects(
    finalizeTempVerification({
      log: (message) => messages.push(message),
      primaryError,
      remove: async () => {
        throw new Error('cleanup failure');
      },
      stage: 'pack tarball',
      successMessage: 'PASS',
      tempPath: '/tmp/umeng-fixture',
    }),
    (error) => {
      assert.equal(error.cause, primaryError);
      assert.match(error.message, /primary verification failure/);
      assert.match(error.message, /cleanup failure/);
      assert.match(error.message, /pack tarball/);
      assert.match(error.message, /\/tmp\/umeng-fixture/);
      return true;
    }
  );
  assert.deepEqual(messages, []);
});
