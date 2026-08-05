require('react-native-gesture-handler/jestSetup');

// RNGH 3 的包根 Pressable 走 Reanimated v3 hook；其官方 jestSetup 目前只替换
// legacy Pressable。保留其余真实导出，只把测试渲染所需的两个壳映射到 RN。
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const { Pressable, View } = require('react-native');
  return {
    ...actual,
    Pressable,
    GestureHandlerRootView: View,
  };
});

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock')
);
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  // Design 0.21 起 usePrefersReducedMotion() 读 Reanimated 的系统信号
  // useReducedMotion(),而官方 mock 不导出它 —— 渲染任何用到它的组件(Switch 等)
  // 会当场 "is not a function"。测试固定返回 false = 不减弱动效,动画路径照常被覆盖。
  useReducedMotion: () => false,
}));
require('react-native-reanimated').setUpTests();

jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);
