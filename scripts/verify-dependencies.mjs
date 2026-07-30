import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const designPeers = [
  '@sbaiahmed1/react-native-blur',
  'react',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-reanimated-carousel',
  'react-native-safe-area-context',
  'react-native-svg',
  'react-native-worklets',
];
const shared = {
  '@unif/react-native-design': '^0.20.0',
  'react-native-reanimated': '^4.5.3',
  'react-native-worklets': '^0.11.3',
};

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(rootDir, relativePath), 'utf8'));
}

function assertDesignPeers(manifest, field, manifestPath) {
  for (const name of designPeers) {
    assert.notEqual(
      manifest[field]?.[name],
      undefined,
      `${manifestPath} must explicitly declare ${name} in ${field}`,
    );
  }
}

function assertInstalledPackageSatisfiesRange({ semver, packageName, version, range, source }) {
  assert.ok(
    semver.satisfies(version, range, { includePrerelease: true }),
    `${packageName}@${version} must satisfy ${source} range ${range}`,
  );
}

const [root, example, website] = await Promise.all([
  readJson('package.json'),
  readJson('example/package.json'),
  readJson('website/package.json'),
]);

assert.deepEqual(
  Object.fromEntries(
    Object.keys(shared).map((name) => [name, root.peerDependencies[name]]),
  ),
  shared,
);
assert.equal(root.peerDependencies['react-native-gesture-handler'], '>=3.0.0 <4.0.0');
assert.equal(example.dependencies['@unif/react-native-umeng'], 'workspace:*');
assert.equal(example.dependencies['@gorhom/bottom-sheet'], undefined);
assert.equal(website.dependencies['@gorhom/bottom-sheet'], undefined);

assertDesignPeers(root, 'peerDependencies', 'package.json');
assertDesignPeers(root, 'devDependencies', 'package.json');
assertDesignPeers(example, 'dependencies', 'example/package.json');
assertDesignPeers(website, 'dependencies', 'website/package.json');

const semverModule = await import('semver');
const semver = semverModule.default ?? semverModule;
const [reactNative, reanimated, worklets] = await Promise.all([
  readJson('node_modules/react-native/package.json'),
  readJson('node_modules/react-native-reanimated/package.json'),
  readJson('node_modules/react-native-worklets/package.json'),
]);

assertInstalledPackageSatisfiesRange({
  semver,
  packageName: 'react-native-reanimated',
  version: reanimated.version,
  range: root.peerDependencies['react-native-reanimated'],
  source: '@unif/react-native-umeng peerDependencies',
});
assertInstalledPackageSatisfiesRange({
  semver,
  packageName: 'react-native-worklets',
  version: worklets.version,
  range: root.peerDependencies['react-native-worklets'],
  source: '@unif/react-native-umeng peerDependencies',
});

for (const [peerName, peerRange] of Object.entries(reanimated.peerDependencies ?? {})) {
  if (peerName === 'react-native-worklets') {
    assertInstalledPackageSatisfiesRange({
      semver,
      packageName: peerName,
      version: worklets.version,
      range: peerRange,
      source: `react-native-reanimated@${reanimated.version} peerDependencies`,
    });
  }
  if (peerName === 'react-native') {
    assertInstalledPackageSatisfiesRange({
      semver,
      packageName: peerName,
      version: reactNative.version,
      range: peerRange,
      source: `react-native-reanimated@${reanimated.version} peerDependencies`,
    });
  }
}

for (const [peerName, peerRange] of Object.entries(worklets.peerDependencies ?? {})) {
  if (peerName === 'react-native') {
    assertInstalledPackageSatisfiesRange({
      semver,
      packageName: peerName,
      version: reactNative.version,
      range: peerRange,
      source: `react-native-worklets@${worklets.version} peerDependencies`,
    });
  }
}

console.log('Dependency contract verified.');
