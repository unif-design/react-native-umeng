import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectExampleContractFailures } from '../verify-example-contract.mjs';
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

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const iosExampleContractPaths = [
  'example/ios/ReactNativeUmengExample/Info.plist',
  'example/ios/ReactNativeUmengExample/AppDelegate.swift',
  'example/ios/ReactNativeUmengExample/SceneDelegateFixture.swift',
];

async function createIosExampleContractFixture(mutate) {
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), 'umeng-ios-contract-fixture-')
  );
  let mutationCount = 0;

  try {
    for (const relativePath of iosExampleContractPaths) {
      const source = await readFile(join(repositoryRoot, relativePath), 'utf8');
      const fixtureSource = mutate
        ? mutate({ relativePath, source })
        : source;
      if (fixtureSource !== source) {
        mutationCount += 1;
      }

      const fixturePath = join(fixtureRoot, relativePath);
      await mkdir(dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, fixtureSource);
    }

    if (mutate) {
      assert.ok(mutationCount > 0, 'fixture mutation must change a source file');
    }
    return fixtureRoot;
  } catch (error) {
    await rm(fixtureRoot, { recursive: true, force: true });
    throw error;
  }
}

function replaceOccurrence(source, search, replacement, occurrence = 1) {
  let index = -1;
  let searchFrom = 0;
  for (let count = 0; count < occurrence; count += 1) {
    index = source.indexOf(search, searchFrom);
    assert.notEqual(
      index,
      -1,
      `fixture mutation cannot find occurrence ${occurrence} of ${search}`
    );
    searchFrom = index + search.length;
  }

  return (
    source.slice(0, index) +
    replacement +
    source.slice(index + search.length)
  );
}

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

test('workspace development graph matches the React Native 0.86.2 fixture', async () => {
  const [root, example, website] = await Promise.all(
    [
      '../../package.json',
      '../../example/package.json',
      '../../website/package.json',
    ].map(
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

  assert.equal(website.dependencies.react, '19.2.3');
  assert.equal(website.dependencies['react-dom'], '19.2.3');
  assert.equal(website.dependencies['react-native'], '0.86.2');
  assert.equal(
    website.devDependencies['@react-native/metro-config'],
    '0.86.2'
  );
});

test('dependency verifier rejects an RN 0.85 package resolution in yarn.lock', async () => {
  const fixtureRoot = await mkdtemp(
    join(tmpdir(), 'umeng-rn-lock-verification-')
  );
  const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
  const verifierPath = fileURLToPath(
    new URL('../verify-dependencies.mjs', import.meta.url)
  );

  try {
    await Promise.all([
      mkdir(join(fixtureRoot, 'example'), { recursive: true }),
      mkdir(join(fixtureRoot, 'website'), { recursive: true }),
    ]);
    await Promise.all(
      ['package.json', 'example/package.json', 'website/package.json'].map(
        async (relativePath) =>
          writeFile(
            join(fixtureRoot, relativePath),
            await readFile(join(repositoryRoot, relativePath), 'utf8')
          )
      )
    );
    await symlink(
      join(repositoryRoot, 'node_modules'),
      join(fixtureRoot, 'node_modules'),
      'dir'
    );

    const lockfile = await readFile(
      join(repositoryRoot, 'yarn.lock'),
      'utf8'
    );
    const reactNativePackageStanza =
      /^"react-native@npm:0\.86\.2":\n  version: 0\.86\.2\n  resolution: "react-native@npm:0\.86\.2"/m;
    assert.match(lockfile, reactNativePackageStanza);

    const lockfileWithUnrelated085 = `${lockfile}
"unrelated-tool@npm:0.85.3":
  version: 0.85.3
  resolution: "unrelated-tool@npm:0.85.3"
`;
    const runVerifier = () =>
      spawnSync(process.execPath, [verifierPath], {
        cwd: fixtureRoot,
        encoding: 'utf8',
      });

    await writeFile(
      join(fixtureRoot, 'yarn.lock'),
      lockfileWithUnrelated085
    );
    const unrelatedResult = runVerifier();
    assert.equal(
      unrelatedResult.status,
      0,
      `unrelated 0.85.3 packages must remain valid:\n${unrelatedResult.stderr}`
    );

    const mutatedLockfile = lockfileWithUnrelated085.replace(
      reactNativePackageStanza,
      '"react-native@npm:0.85.3":\n  version: 0.85.3\n  resolution: "react-native@npm:0.85.3"'
    );
    await writeFile(join(fixtureRoot, 'yarn.lock'), mutatedLockfile);

    const reactNativeResult = runVerifier();
    const verifierOutput = `${reactNativeResult.stderr}\n${reactNativeResult.stdout}`;
    assert.notEqual(
      reactNativeResult.status,
      0,
      'the dependency verifier must reject an RN 0.85 package resolution'
    );
    assert.match(verifierOutput, /react-native@npm:0\.85\.3/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('versioned example Pod lock remains visible to Git maintenance', () => {
  const repositoryRoot = new URL('../../', import.meta.url);
  const lockfile = 'example/ios/Podfile.lock';
  const tracked = spawnSync(
    'git',
    ['ls-files', '--error-unmatch', lockfile],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }
  );
  assert.equal(
    tracked.status,
    0,
    `Pod lock must remain tracked: ${tracked.stderr}`
  );

  const ignored = spawnSync(
    'git',
    ['check-ignore', '--no-index', '-v', lockfile],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }
  );
  assert.equal(
    ignored.status,
    1,
    `tracked Pod lock must not match an ignore rule: ${ignored.stdout}`
  );
});

test('example native contract verifier is registered and executable', async () => {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8')
  );
  assert.equal(
    manifest.scripts['verify:example-contract'],
    'node scripts/verify-example-contract.mjs'
  );

  const verifierPath = join(
    repositoryRoot,
    'scripts/verify-example-contract.mjs'
  );
  const result = spawnSync(process.execPath, [verifierPath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(
    result.status,
    0,
    [result.stderr, result.stdout].filter(Boolean).join('\n')
  );
});

test('example iOS contract accepts a valid temporary fixture', async () => {
  const fixtureRoot = await createIosExampleContractFixture();
  try {
    assert.deepEqual(
      collectExampleContractFailures({
        platform: 'ios',
        repositoryRoot: fixtureRoot,
      }),
      []
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('example iOS contract rejects a prefixed scheme hidden in a duplicate URL type', async () => {
  const fixtureRoot = await createIosExampleContractFixture(
    ({ relativePath, source }) => {
      if (
        relativePath !==
        'example/ios/ReactNativeUmengExample/Info.plist'
      ) {
        return source;
      }

      const dingTalkEntryStart = [
        '\t\t<dict>',
        '\t\t\t<key>CFBundleTypeRole</key>',
        '\t\t\t<string>Editor</string>',
        '\t\t\t<key>CFBundleURLName</key>',
        '\t\t\t<string>dingtalk</string>',
      ].join('\n');
      const hiddenWechatEntry = [
        '\t\t<dict>',
        '\t\t\t<key>CFBundleTypeRole</key>',
        '\t\t\t<string>Editor</string>',
        '\t\t\t<key>CFBundleURLName</key>',
        '\t\t\t<string>wechat</string>',
        '\t\t\t<key>CFBundleURLSchemes</key>',
        '\t\t\t<array>',
        '\t\t\t\t<string>wxYOUR_HIDDEN_WECHAT_ID</string>',
        '\t\t\t</array>',
        '\t\t</dict>',
      ].join('\n');

      return replaceOccurrence(
        source,
        dingTalkEntryStart,
        `${hiddenWechatEntry}\n${dingTalkEntryStart}`
      );
    }
  );

  try {
    const failures = collectExampleContractFailures({
      platform: 'ios',
      repositoryRoot: fixtureRoot,
    });
    assert.match(
      failures.join('\n'),
      /WeChat URL scheme placeholder must not have a wx prefix/
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('example iOS contract rejects callback argument mutations', async (t) => {
  const appDelegatePath =
    'example/ios/ReactNativeUmengExample/AppDelegate.swift';
  const sceneDelegatePath =
    'example/ios/ReactNativeUmengExample/SceneDelegateFixture.swift';
  const mutations = [
    {
      name: 'AppDelegate URL uses callback URL and options',
      path: appDelegatePath,
      search:
        'UmengBootstrap.shared().handleOpen(url, options: options)',
      replacement:
        'UmengBootstrap.shared().handleOpen(URL(string: "https://invalid.example")!, options: [:])',
      expectedFailure: /AppDelegate\.swift URL callback.*Umeng arguments/,
    },
    {
      name: 'AppDelegate URL uses callback application',
      path: appDelegatePath,
      search: ['      application,', '      open: url,'].join('\n'),
      replacement: [
        '      UIApplication.shared,',
        '      open: url,',
      ].join('\n'),
      expectedFailure: /AppDelegate\.swift URL callback.*RCTLinking arguments/,
    },
    {
      name: 'AppDelegate Universal Link uses callback activity',
      path: appDelegatePath,
      search:
        'UmengBootstrap.shared().handleUniversalLink(userActivity)',
      replacement:
        'UmengBootstrap.shared().handleUniversalLink(NSUserActivity(activityType: "invalid"))',
      expectedFailure:
        /AppDelegate\.swift Universal Link callback.*Umeng arguments/,
    },
    {
      name: 'Scene URL derives options from its current context',
      path: sceneDelegatePath,
      search: 'let options = applicationOptions(for: context)',
      replacement:
        'let options: [UIApplication.OpenURLOptionsKey: Any] = [:]',
      expectedFailure: /SceneDelegateFixture\.swift URL callback.*context/,
    },
    {
      name: 'Scene Universal Link forwards its current activity',
      path: sceneDelegatePath,
      search: 'continue: userActivity',
      replacement:
        'continue: NSUserActivity(activityType: "invalid")',
      expectedFailure:
        /SceneDelegateFixture\.swift Universal Link callback.*RCTLinking arguments/,
    },
    {
      name: 'Scene connection URL forwards its current context URL',
      path: sceneDelegatePath,
      search: 'open: context.url',
      replacement:
        'open: URL(string: "https://invalid.example")!',
      occurrence: 2,
      expectedFailure:
        /SceneDelegateFixture\.swift connection callback.*RCTLinking arguments/,
    },
    {
      name: 'Scene connection Universal Link forwards its current activity',
      path: sceneDelegatePath,
      search:
        'UmengBootstrap.shared().handleUniversalLink(userActivity)',
      replacement:
        'UmengBootstrap.shared().handleUniversalLink(NSUserActivity(activityType: "invalid"))',
      occurrence: 2,
      expectedFailure:
        /SceneDelegateFixture\.swift connection callback.*Umeng arguments/,
    },
  ];

  for (const mutation of mutations) {
    await t.test(mutation.name, async () => {
      const fixtureRoot = await createIosExampleContractFixture(
        ({ relativePath, source }) =>
          relativePath === mutation.path
            ? replaceOccurrence(
                source,
                mutation.search,
                mutation.replacement,
                mutation.occurrence
              )
            : source
      );

      try {
        const failures = collectExampleContractFailures({
          platform: 'ios',
          repositoryRoot: fixtureRoot,
        });
        assert.match(failures.join('\n'), mutation.expectedFailure);
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    });
  }
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

test('Turbo example test dry-run expands Jest harness inputs', () => {
  const result = spawnSync('yarn', ['turbo', 'run', 'test', '--dry=json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  assert.equal(
    result.status,
    0,
    [result.stderr, result.stdout].filter(Boolean).join('\n')
  );

  const dryRun = JSON.parse(result.stdout);
  const exampleTask = dryRun.tasks.find(
    ({ taskId }) => taskId === '@unif/react-native-umeng-example#test'
  );
  assert.ok(exampleTask, 'Turbo dry-run must discover the example test task');

  for (const harnessPath of ['jest.config.js', 'jest.setup.ts']) {
    assert.ok(
      Object.hasOwn(exampleTask.inputs, harnessPath),
      `Turbo example test inputs must expand ${harnessPath}`
    );
  }
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
