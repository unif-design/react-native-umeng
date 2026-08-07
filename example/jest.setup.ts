// design 的 peer 接线(RNGH jestSetup / RNGH 壳 / worklets / reanimated / safe-area)
// 已由 `@unif/react-native-design/jest-preset` 提供,不要在这里重复一份 —— 重复注册会
// 与 preset 里的 jest.mock 抢同一个模块 key。本文件只留本仓自己的接线。
jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);
