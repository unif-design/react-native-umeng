import assert from 'node:assert/strict';

export const sharedDependencyRanges = {
  '@unif/react-native-design': '^0.21.1',
  'react-native-reanimated': '^4.5.3',
  'react-native-worklets': '^0.11.3',
};

export const requiredReactNativeLockResolution =
  'react-native@npm:0.86.2';

export function assertReactNativeLockfileResolution(lockfile) {
  const packageDescriptors = [
    ...lockfile.matchAll(/^"(react-native@npm:[^"]+)":$/gm),
  ].map(([, descriptor]) => descriptor);
  const packageResolutions = [
    ...lockfile.matchAll(
      /^  resolution: "(react-native@npm:[^"]+)"$/gm
    ),
  ].map(([, resolution]) => resolution);

  assert.deepEqual(
    packageDescriptors,
    [requiredReactNativeLockResolution],
    `yarn.lock must contain exactly one ${requiredReactNativeLockResolution} package key; found ${packageDescriptors.join(', ') || 'none'}`
  );
  assert.deepEqual(
    packageResolutions,
    [requiredReactNativeLockResolution],
    `yarn.lock must contain exactly one ${requiredReactNativeLockResolution} package resolution; found ${packageResolutions.join(', ') || 'none'}`
  );
}

export function assertSharedDependencyRanges(
  manifest,
  field,
  manifestPath
) {
  for (const [name, expectedRange] of Object.entries(
    sharedDependencyRanges
  )) {
    assert.equal(
      manifest[field]?.[name],
      expectedRange,
      `${manifestPath} must declare ${name} as ${expectedRange} in ${field}`
    );
  }
}
