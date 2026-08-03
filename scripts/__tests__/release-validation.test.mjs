import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import * as publishContract from '../verify-publish-contract.mjs';
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

test('native runtime sources and new init helpers cannot bypass minor', () => {
  const initializationPaths = [
    'src/internal/newInitializationState.ts',
    'android/src/main/java/com/unif/reactnativeumeng/UmengInitializationState.kt',
    'android/src/main/java/com/unif/reactnativeumeng/UmengShareModule.kt',
    'android/src/main/java/com/unif/reactnativeumeng/UmengAnalyticsModule.kt',
    'android/src/main/java/com/unif/reactnativeumeng/UmengVendorStages.kt',
    'ios/UmengInitializationState.mm',
    'ios/UmengShare.mm',
    'ios/UmengAnalytics.mm',
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

  for (const relativePath of [
    'src/ShareSheet/ShareSheetController.ts',
    'android/src/test/java/com/unif/reactnativeumeng/UmengBootstrapTest.kt',
  ]) {
    assert.equal(
      isInitializationContractPath(relativePath),
      false,
      relativePath
    );
  }
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

test('root and example development graph matches the React Native 0.86.2 fixture', async () => {
  const [root, example] = await Promise.all(
    ['../../package.json', '../../example/package.json'].map(
      async (relativePath) =>
        JSON.parse(
          await readFile(new URL(relativePath, import.meta.url), 'utf8')
        )
    )
  );

  assert.equal(root.devDependencies['react-native'], '0.86.2');
  assert.equal(root.devDependencies['@react-native/babel-preset'], '0.86.2');
  assert.equal(root.devDependencies['@react-native/eslint-config'], '0.86.2');
  assert.equal(root.devDependencies['@react-native/jest-preset'], '0.86.2');
  assert.equal(root.devDependencies['@react-native/metro-config'], '0.86.2');
  assert.equal(root.peerDependencies['react-native'], '*');

  assert.equal(example.dependencies.react, '19.2.3');
  assert.equal(example.dependencies['react-native'], '0.86.2');
  assert.equal(
    example.devDependencies['@react-native/babel-preset'],
    '0.86.2'
  );
  assert.equal(
    example.devDependencies['@react-native/jest-preset'],
    '0.86.2'
  );
  assert.equal(
    example.devDependencies['@react-native/metro-config'],
    '0.86.2'
  );
  assert.equal(
    example.devDependencies['@react-native/typescript-config'],
    '0.86.2'
  );
  assert.equal(
    example.devDependencies['@react-native-community/cli'],
    '20.1.0'
  );
  assert.equal(
    example.devDependencies['@react-native-community/cli-platform-android'],
    '20.1.0'
  );
  assert.equal(
    example.devDependencies['@react-native-community/cli-platform-ios'],
    '20.1.0'
  );
  assert.equal(example.devDependencies['react-test-renderer'], '19.2.3');
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

test('release workflow keeps the exact published-contract trigger paths', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  const pushTrigger = workflow
    .split(/^  push:/m)[1]
    ?.split(/^  workflow_dispatch:/m)[0];

  assert.match(pushTrigger ?? '', /branches:\s*\[main\]/);
  assert.deepEqual(
    [...(pushTrigger ?? '').matchAll(/^\s{6}- '([^']+)'$/gm)].map(
      ([, relativePath]) => relativePath
    ),
    [
      'package.json',
      'src/**',
      'scripts/**',
      'ios/**',
      'android/**',
      '*.podspec',
      'babel.config.js',
      'tsconfig.build.json',
      'tsconfig.json',
    ]
  );
});

test('published docs retain current Android CI and device evidence', async () => {
  const fullAutomationEvidencePaths = [
    '../../README.md',
    '../../website/docs/intro.md',
    '../../website/docs/api/common.md',
    '../../website/docs/getting-started/quick-start.md',
    '../../website/docs/guides/privacy-pipl.md',
    '../../website/docs/native-setup/android.md',
  ];

  for (const relativePath of fullAutomationEvidencePaths) {
    const content = await readFile(
      new URL(relativePath, import.meta.url),
      'utf8'
    );

    assert.match(
      content,
      /Android CI 已通过[^。\n]*native contract[^。\n]*JVM[^。\n]*minif(?:y|ied)[^。\n]*merged manifest/,
      `${relativePath}: 缺少当前 Android 自动化证据`
    );
    assert.match(
      content,
      /真实|真机/,
      `${relativePath}: 缺少真实平台或真机验证边界`
    );
  }

  const shareDocs = await readFile(
    new URL('../../website/docs/api/share.md', import.meta.url),
    'utf8'
  );
  assert.match(
    shareDocs,
    /Android native contract\/JVM tests 已验证/,
    'share docs: 缺少 Android 分享门禁证据'
  );
  assert.match(
    shareDocs,
    /真实 App/,
    'share docs: 缺少真实 App 验证边界'
  );
});

test('explicit release increment selects an exact version for validation and release', () => {
  assert.deepEqual(
    parsePublishContractArgs([
      '--increment',
      'minor',
      '--squash-title',
      'feat(ci): enforce squash release contract',
      '--github-output',
      '/tmp/github-output',
    ]),
    {
      githubOutput: '/tmp/github-output',
      increment: 'minor',
      squashTitle: 'feat(ci): enforce squash release contract',
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

test('squash title classification matches the Angular release floor', () => {
  assert.equal(
    typeof publishContract.squashTitleReleaseLevel,
    'function',
    'squashTitleReleaseLevel must be exported'
  );

  assert.equal(
    publishContract.squashTitleReleaseLevel('fix: close callback race'),
    'patch'
  );
  assert.equal(
    publishContract.squashTitleReleaseLevel('feat: enforce release floor'),
    'minor'
  );
  assert.equal(
    publishContract.squashTitleReleaseLevel(
      'feat(ci): enforce release floor'
    ),
    'minor'
  );
  assert.throws(
    () => publishContract.squashTitleReleaseLevel('release without a type'),
    /invalid squash title/i
  );
});

test('squash title cannot understate the file-based release floor', () => {
  assert.equal(
    typeof publishContract.assertSquashTitleReleaseLevel,
    'function',
    'assertSquashTitleReleaseLevel must be exported'
  );

  assert.throws(
    () =>
      publishContract.assertSquashTitleReleaseLevel({
        title: 'fix: close callback race',
        minimumLevel: 'minor',
      }),
    /squash title[\s\S]*patch[\s\S]*minor[\s\S]*feat:/i
  );
  assert.doesNotThrow(() =>
    publishContract.assertSquashTitleReleaseLevel({
      title: 'feat(ci): enforce release floor',
      minimumLevel: 'minor',
    })
  );
  assert.doesNotThrow(() =>
    publishContract.assertSquashTitleReleaseLevel({
      title: 'fix: close callback race',
      minimumLevel: 'patch',
    })
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
