import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  assertReactNativeLockfileResolution,
  assertSharedDependencyRanges,
} from './dependency-contract.mjs';

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
const installedPackageNames = [
  ...new Set([
    ...designPeers,
    '@unif/react-native-design',
    '@babel/core',
    '@react-native/metro-config',
  ]),
];
const requiredSecurityResolutions = {
  'copy-webpack-plugin/serialize-javascript': '7.0.7',
  'css-minimizer-webpack-plugin/serialize-javascript': '7.0.7',
};
const requiredRootReactNativeDevelopmentGraph = {
  'react': '19.2.3',
  'react-native': '0.86.2',
  '@react-native/babel-preset': '0.86.2',
  '@react-native/eslint-config': '0.86.2',
  '@react-native/jest-preset': '0.86.2',
  '@react-native/metro-config': '0.86.2',
  'react-test-renderer': '19.2.3',
};
const requiredExampleReactNativeDevelopmentGraph = {
  '@react-native-community/cli': '20.1.0',
  '@react-native-community/cli-platform-android': '20.1.0',
  '@react-native-community/cli-platform-ios': '20.1.0',
  '@react-native/babel-preset': '0.86.2',
  '@react-native/jest-preset': '0.86.2',
  '@react-native/metro-config': '0.86.2',
  '@react-native/typescript-config': '0.86.2',
  'react-test-renderer': '19.2.3',
};
const requiredWebsiteReactNativeRuntimeGraph = {
  'react': '19.2.3',
  'react-dom': '19.2.3',
  'react-native': '0.86.2',
};
const requiredWebsiteReactNativeDevelopmentGraph = {
  '@react-native/metro-config': '0.86.2',
};
const lockedPackageContracts = {
  '@unif/react-native-design': {
    version: '0.23.0',
    peerDependencies: {
      '@sbaiahmed1/react-native-blur': '>=4',
      react: '>=19.2.3 <20.0.0',
      'react-native': '>=0.86.0 <0.87.0',
      'react-native-gesture-handler': '>=3.0.0 <4.0.0',
      'react-native-reanimated': '>=4.5.2 <4.6.0',
      'react-native-reanimated-carousel': '>=5.0.0 <6.0.0',
      'react-native-safe-area-context': '>=5',
      'react-native-svg': '>=15',
      'react-native-worklets': '>=0.11.0 <0.12.0',
    },
  },
  'react-native-gesture-handler': {
    version: '3.1.0',
    peerDependencies: {
      react: '*',
      'react-native': '*',
    },
  },
  'react-native-reanimated': {
    peerDependencies: {
      react: '*',
      'react-native': '0.83 - 0.86',
      'react-native-worklets': '0.10.x - 0.11.x',
    },
  },
  'react-native-reanimated-carousel': {
    version: '5.0.0',
    peerDependencies: {
      react: '>=18.0.0',
      'react-native': '>=0.80.0',
      'react-native-gesture-handler': '>=2.9.0 <3.0.0',
      'react-native-reanimated': '>=4.1.0',
      'react-native-worklets': '>=0.5.0',
    },
  },
  'react-native-worklets': {
    peerDependencies: {
      '@babel/core': '*',
      '@react-native/metro-config': '*',
      react: '*',
      'react-native': '0.83 - 0.86',
    },
  },
};
const approvedPeerException = {
  packageName: 'react-native-reanimated-carousel',
  packageVersion: '5.0.0',
  peerName: 'react-native-gesture-handler',
  peerRange: '>=2.9.0 <3.0.0',
  installedVersion: '3.1.0',
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

function assertExactDependencies(manifest, field, manifestPath, expected) {
  for (const [name, version] of Object.entries(expected)) {
    assert.equal(
      manifest[field]?.[name],
      version,
      `${manifestPath} must declare ${name} as ${version} in ${field}`,
    );
  }
}

function assertInstalledPackageSatisfiesRange({ semver, packageName, version, range, source }) {
  assert.ok(
    semver.satisfies(version, range, { includePrerelease: true }),
    `${packageName}@${version} must satisfy ${source} range ${range}`,
  );
}

function assertRequiredPeer(manifest, packageName, peerName) {
  assert.equal(
    typeof manifest.peerDependencies?.[peerName],
    'string',
    `${packageName}@${manifest.version} must declare ${peerName} in peerDependencies`,
  );
}

function assertLockedPackageContract(packageName, manifest, contract) {
  if (contract.version) {
    assert.equal(manifest.version, contract.version, `${packageName} version must remain locked`);
  }
  if (contract.peerDependencies) {
    assert.deepEqual(
      manifest.peerDependencies,
      contract.peerDependencies,
      `${packageName}@${manifest.version} peerDependencies must remain locked`,
    );
  }
}

function assertPackagePeerCompatibility({ semver, packageName, manifest, installedPackages }) {
  for (const [peerName, peerRange] of Object.entries(manifest.peerDependencies ?? {})) {
    const peerManifest = installedPackages[peerName];
    assert.ok(peerManifest, `${packageName}@${manifest.version} requires installed ${peerName}`);

    if (
      packageName === approvedPeerException.packageName &&
      manifest.version === approvedPeerException.packageVersion &&
      peerName === approvedPeerException.peerName &&
      peerRange === approvedPeerException.peerRange
    ) {
      assert.equal(
        peerManifest.version,
        approvedPeerException.installedVersion,
        'approved Carousel/Gesture Handler exception must remain version-locked',
      );
      assert.ok(
        !semver.satisfies(peerManifest.version, peerRange, { includePrerelease: true }),
        'approved Carousel/Gesture Handler exception must remain an explicit incompatibility',
      );
      continue;
    }

    assertInstalledPackageSatisfiesRange({
      semver,
      packageName: peerName,
      version: peerManifest.version,
      range: peerRange,
      source: `${packageName}@${manifest.version} peerDependencies`,
    });
  }
}

const [root, example, website, lockfile] = await Promise.all([
  readJson('package.json'),
  readJson('example/package.json'),
  readJson('website/package.json'),
  readFile(resolve(rootDir, 'yarn.lock'), 'utf8'),
]);

assertReactNativeLockfileResolution(lockfile);
assertSharedDependencyRanges(root, 'peerDependencies', 'package.json');
assertSharedDependencyRanges(root, 'devDependencies', 'package.json');
assertSharedDependencyRanges(example, 'dependencies', 'example/package.json');
assertSharedDependencyRanges(website, 'dependencies', 'website/package.json');
assertExactDependencies(
  root,
  'devDependencies',
  'package.json',
  requiredRootReactNativeDevelopmentGraph,
);
assert.equal(
  root.peerDependencies['react-native'],
  '*',
  'package.json must keep the public react-native peer unchanged',
);
assert.equal(
  root.peerDependencies.react,
  '*',
  'package.json must keep the public react peer unchanged',
);
assert.equal(
  example.dependencies.react,
  '19.2.3',
  'example/package.json must declare react as 19.2.3 in dependencies',
);
assert.equal(
  example.dependencies['react-native'],
  '0.86.2',
  'example/package.json must declare react-native as 0.86.2 in dependencies',
);
assertExactDependencies(
  example,
  'devDependencies',
  'example/package.json',
  requiredExampleReactNativeDevelopmentGraph,
);
assertExactDependencies(
  website,
  'dependencies',
  'website/package.json',
  requiredWebsiteReactNativeRuntimeGraph,
);
assertExactDependencies(
  website,
  'devDependencies',
  'website/package.json',
  requiredWebsiteReactNativeDevelopmentGraph,
);
assert.equal(root.peerDependencies['react-native-gesture-handler'], '>=3.0.0 <4.0.0');
assert.deepEqual(
  Object.fromEntries(
    Object.keys(requiredSecurityResolutions).map((name) => [name, root.resolutions?.[name]]),
  ),
  requiredSecurityResolutions,
);
assert.equal(
  root.resolutions?.['serialize-javascript'],
  undefined,
  'serialize-javascript security resolution must remain scoped to its two webpack parents',
);
assert.equal(example.dependencies['@unif/react-native-umeng'], 'workspace:*');
assert.equal(example.dependencies['@gorhom/bottom-sheet'], undefined);
assert.equal(website.dependencies['@gorhom/bottom-sheet'], undefined);

assertDesignPeers(root, 'peerDependencies', 'package.json');
assertDesignPeers(root, 'devDependencies', 'package.json');
assertDesignPeers(example, 'dependencies', 'example/package.json');
assertDesignPeers(website, 'dependencies', 'website/package.json');

const semverModule = await import('semver');
const semver = semverModule.default ?? semverModule;
const installedPackages = Object.fromEntries(
  await Promise.all(
    installedPackageNames.map(async (packageName) => [
      packageName,
      await readJson(`node_modules/${packageName}/package.json`),
    ]),
  ),
);

assertRequiredPeer(
  installedPackages['react-native-reanimated'],
  'react-native-reanimated',
  'react-native-worklets',
);
assertRequiredPeer(
  installedPackages['react-native-reanimated'],
  'react-native-reanimated',
  'react-native',
);
assertRequiredPeer(installedPackages['react-native-worklets'], 'react-native-worklets', 'react-native');

for (const [packageName, contract] of Object.entries(lockedPackageContracts)) {
  assertLockedPackageContract(packageName, installedPackages[packageName], contract);
}

for (const [packageName, range] of Object.entries(root.peerDependencies)) {
  const installedPackage = installedPackages[packageName];
  assert.ok(installedPackage, `@unif/react-native-umeng peer ${packageName} must be installed`);
  assertInstalledPackageSatisfiesRange({
    semver,
    packageName,
    version: installedPackage.version,
    range,
    source: '@unif/react-native-umeng peerDependencies',
  });
}

for (const [packageName, contract] of Object.entries(lockedPackageContracts)) {
  if (contract.peerDependencies) {
    assertPackagePeerCompatibility({
      semver,
      packageName,
      manifest: installedPackages[packageName],
      installedPackages,
    });
  }
}

console.log(
  'Dependency contract verified with the approved Carousel/Gesture Handler peer exception.',
);
