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
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);
require('react-native-reanimated').setUpTests();

jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);
