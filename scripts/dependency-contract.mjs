import assert from 'node:assert/strict';

export const sharedDependencyRanges = {
  '@unif/react-native-design': '^0.20.0',
  'react-native-reanimated': '^4.5.3',
  'react-native-worklets': '^0.11.3',
};

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
