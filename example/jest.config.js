// design 的 jest 接线由包自己提供(`@unif/react-native-design/jest-preset`):RN 官方
// preset + resolver + transformIgnorePatterns 放行清单 + peer 的官方桩 / mock。
// 本仓只保留自己那两条 moduleNameMapper。
module.exports = {
  preset: '@unif/react-native-design/jest-preset',
  moduleNameMapper: {
    // example 测的是当前源码,不是已发布产物
    '^@unif/react-native-umeng$': '<rootDir>/../src/index.ts',
    '^@unif/react-native-umeng/mock$': '<rootDir>/../src/mock.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // transformIgnorePatterns 不写 —— 继承 preset(内容与原先本仓那份逐字相同)。
  // 双拷贝钉住条目也不需要:design 在 example/node_modules 下是**真实拷贝**,
  // preset 的 jest-setup 与 example 测试解析 RNGH / reanimated / worklets /
  // safe-area 时向上走的都是 example 这份 node_modules,两边天然同一份。
};
