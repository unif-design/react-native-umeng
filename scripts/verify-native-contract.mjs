import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { collectExampleContractFailures } from './verify-example-contract.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requestedPlatform = process.argv[2];

if (
  requestedPlatform !== undefined &&
  requestedPlatform !== '--platform' &&
  requestedPlatform !== 'android' &&
  requestedPlatform !== 'ios'
) {
  console.error(
    'Usage: node scripts/verify-native-contract.mjs [--platform android|ios]'
  );
  process.exit(2);
}

let platform = 'all';
if (requestedPlatform === '--platform') {
  platform = process.argv[3] ?? '';
} else if (requestedPlatform === 'android' || requestedPlatform === 'ios') {
  platform = requestedPlatform;
}

if (!['all', 'android', 'ios'].includes(platform) || process.argv.length > 4) {
  console.error(
    'Usage: node scripts/verify-native-contract.mjs [--platform android|ios]'
  );
  process.exit(2);
}

const failures = [];

function source(relativePath) {
  try {
    return readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
  } catch {
    failures.push(`${relativePath}: file is missing`);
    return '';
  }
}

function expectContract(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function openingTag(xml, element, name) {
  const tags = xml.match(new RegExp(`<${element}\\b[^>]*>`, 'g')) ?? [];
  return tags.find((tag) => tag.includes(`android:name="${name}"`));
}

const nativeCommon = source('src/NativeUmengCommon.ts');
expectContract(
  /\binitialize\(config:\s*Object\):\s*Promise<void>/.test(nativeCommon),
  'src/NativeUmengCommon.ts: native interface must expose initialize(config)'
);
expectContract(
  !/\bpreInit\s*\(/.test(nativeCommon) && !/^\s*init\s*\(/m.test(nativeCommon),
  'src/NativeUmengCommon.ts: native interface must not expose preInit/init'
);

if (platform === 'all' || platform === 'android') {
  const commonModule = source(
    'android/src/main/java/com/unif/reactnativeumeng/UmengCommonModule.kt'
  );
  const manifest = source('android/src/main/AndroidManifest.xml');
  const filePaths = source(
    'android/src/main/res/xml/react_native_umeng_file_paths.xml'
  );
  const consumerRules = source('android/consumer-rules.pro');

  expectContract(
    /\boverride fun initialize\s*\(/.test(commonModule),
    'Android bridge: must expose initialize(config, promise)'
  );
  expectContract(
    !/\boverride fun preInit\s*\(/.test(commonModule) &&
      !/\boverride fun init\s*\(/.test(commonModule),
    'Android bridge: must not expose native preInit/init'
  );

  const provider = openingTag(
    manifest,
    'provider',
    'androidx.core.content.FileProvider'
  );
  expectContract(
    provider?.includes('android:authorities="${applicationId}.fileprovider"') &&
      provider.includes('android:exported="false"') &&
      provider.includes('android:grantUriPermissions="true"'),
    'Android Manifest: FileProvider must use the applicationId authority and narrow access'
  );
  expectContract(
    manifest.includes('android:resource="@xml/react_native_umeng_file_paths"'),
    'Android Manifest: FileProvider path metadata is missing'
  );

  for (const activityName of [
    '${applicationId}.wxapi.WXEntryActivity',
    '${applicationId}.ddshare.DDShareActivity',
  ]) {
    const activity = openingTag(manifest, 'activity', activityName);
    expectContract(
      activity?.includes('android:enabled="false"'),
      `Android Manifest: ${activityName} must be declared disabled`
    );
  }

  const pathElements =
    filePaths.match(/<(?!\/|paths\b|[!?])[\w-]+\b[^>]*\/>/g) ?? [];
  expectContract(
    pathElements.length === 1 &&
      /^<external-files-path\b/.test(pathElements[0]) &&
      pathElements[0].includes('name="umeng_cache"') &&
      pathElements[0].includes('path="umeng_cache/"'),
    'Android FileProvider paths: only external-files-path umeng_cache/ may be exposed'
  );

  expectContract(
    consumerRules.includes(
      '-keep class com.android.dingtalk.share.ddsharemodule.** { *; }'
    ),
    'Android consumer rules: exact DingTalk ddsharemodule package is missing'
  );
  expectContract(
    consumerRules.includes('-keepattributes Signature'),
    'Android consumer rules: Signature attribute preservation is missing'
  );
}

if (platform === 'all' || platform === 'ios') {
  const commonModule = source('ios/UmengCommon.mm');
  const podspec = source('ReactNativeUmeng.podspec');
  const packageJsonText = source('package.json');
  let packageJson = {};

  try {
    packageJson = JSON.parse(packageJsonText);
  } catch {
    failures.push('package.json: invalid JSON');
  }

  expectContract(
    /-\s*\(void\)initialize:\s*\(NSDictionary\s*\*\)config/.test(commonModule),
    'iOS bridge: must expose initialize(config, resolve, reject)'
  );
  expectContract(
    !/-\s*\(void\)preInit:/.test(commonModule) &&
      !/-\s*\(void\)init:/.test(commonModule),
    'iOS bridge: must not expose native preInit/init'
  );

  const modulesProvider = packageJson.codegenConfig?.ios?.modulesProvider;
  for (const moduleName of ['UmengCommon', 'UmengShare', 'UmengAnalytics']) {
    expectContract(
      modulesProvider?.[moduleName] === moduleName,
      `Codegen iOS modulesProvider: ${moduleName} mapping is missing`
    );
  }

  expectContract(
    /:tag\s*=>\s*"v#\{s\.version\}"/.test(podspec),
    'ReactNativeUmeng.podspec: source tag must use v#{s.version}'
  );
}

failures.push(
  ...collectExampleContractFailures({
    platform,
    repositoryRoot,
  })
);

if (failures.length > 0) {
  console.error(`Native contract verification failed (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Native contract verification passed (${platform}).`);
