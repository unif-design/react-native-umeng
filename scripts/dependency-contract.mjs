import assert from 'node:assert/strict';

/**
 * 跨 manifest 共享的依赖 range。值有两种写法:
 *   - 字符串:peer 与安装侧(dev / example / website)同值
 *   - `{ peer, install }`:两者语义不同 —— **peer 是对外兼容范围(该宽)**,
 *     写窄了会把下游卡在旧版;**install 是本仓验证基线(该窄且确定)**。
 *     ⚠️ peer 里别用 `^`:0.x 下它锁 minor(`^0.21.1` 不含 0.22),
 *     等于把上游每次 minor 都变成 breaking。
 */
export const sharedDependencyRanges = {
  '@unif/react-native-design': {
    peer: '>=0.21.0 <1.0.0',
    install: '^0.23.1',
  },
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

/** 把契约摊平成某个 manifest field 该有的 `{ 包名: range }`。 */
export function sharedRangesFor(field) {
  return Object.fromEntries(
    Object.entries(sharedDependencyRanges).map(([name, expected]) => [
      name,
      typeof expected === 'string'
        ? expected
        : field === 'peerDependencies'
          ? expected.peer
          : expected.install,
    ])
  );
}

export function assertSharedDependencyRanges(
  manifest,
  field,
  manifestPath
) {
  for (const [name, expectedRange] of Object.entries(
    sharedRangesFor(field)
  )) {
    assert.equal(
      manifest[field]?.[name],
      expectedRange,
      `${manifestPath} must declare ${name} as ${expectedRange} in ${field}`
    );
  }
}
