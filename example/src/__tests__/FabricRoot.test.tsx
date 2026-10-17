// Exercise the shipped RN renderer as well as react-test-renderer's concurrent
// root. Only the native mounting/UI boundary is replaced; hooks and scheduling
// execute in React Fabric 0.88.0 against the actual controller and host.
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (values: any) => values.ios ?? values.default,
  },
  StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {} },
  ScrollView: 'View',
  View: 'View',
  Text: 'RCTText',
  Modal: 'Modal',
  Pressable: 'Pressable',
  TurboModuleRegistry: {
    get: (name: string) =>
      name === 'UmengCommon'
        ? {
            getConfiguredShareTargets: async () => ['wechat_session'],
          }
        : { isInstalled: async () => true },
  },
}));
jest.mock('@unif/react-native-design', () => ({
  useThemedStyles: (make: any) =>
    make({ surface: '#fff', foreground: '#000' }, {}),
  ThemeProvider: ({ children }: any) => children,
  NavBar: 'NavBar',
  Grid: 'Grid',
  EntryCard: 'EntryCard',
  Card: 'Card',
  IconButton: 'IconButton',
  Form: 'Form',
  FormGroup: 'FormGroup',
  FormRow: 'FormRow',
  Input: 'Input',
  Segmented: 'Segmented',
  Switch: 'Switch',
  StatusDot: 'StatusDot',
  Tag: 'Tag',
  Cell: 'Cell',
  Button: 'Button',
  GlassLayer: 'GlassLayer',
}));
jest.mock('react-native-svg', () => ({ Svg: 'Svg', Path: 'Path' }));
jest.mock('@unif/react-native-icons', () => ({
  WechatFilled: 'WechatFilled',
  DingtalkFilled: 'DingtalkFilled',
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
}));
jest.mock('react-native/react-private-interface', () => {
  const roots = new Map();
  const node = (tag: number, name: string, root: number, props: any) => ({
    tag,
    name,
    root,
    props,
    children: [],
  });
  return {
    roots,
    commits: [],
    ReactNativeViewConfigRegistry: {
      customBubblingEventTypes: {},
      customDirectEventTypes: {},
      get: (name: string) => ({ uiViewClassName: name, validAttributes: {} }),
    },
    ReactFiberErrorDialog: { showErrorDialog: () => false },
    createAttributePayload: (props: any) => props,
    diffAttributePayloads: (_old: any, props: any) => props,
    deepFreezeAndThrowOnMutationInDev: () => {},
    createPublicRootInstance: (tag: number) => ({ tag }),
    createPublicInstance: (tag: number) => ({ tag }),
    createPublicTextInstance: (value: any) => value,
    fabricUIManager: {
      createNode: node,
      cloneNodeWithNewChildren: (value: any) => ({ ...value, children: [] }),
      cloneNodeWithNewChildrenAndProps: (value: any, props: any) => ({
        ...value,
        props,
        children: [],
      }),
      cloneNodeWithNewProps: (value: any, props: any) => ({ ...value, props }),
      createChildSet: () => [],
      appendChild: (parent: any, child: any) => parent.children.push(child),
      appendChildToSet: (parent: any[], child: any) => parent.push(child),
      completeRoot: (tag: number, children: any[]) => {
        const boundary = require('react-native/react-private-interface');
        if (boundary.failAfter && --boundary.failAfter === 0)
          throw new Error('native mount failure');
        roots.set(tag, children);
        boundary.commits.push(children);
      },
      registerEventHandler: () => {},
      unstable_getCurrentEventPriority: () => 32,
      unstable_DiscreteEventPriority: 2,
      unstable_ContinuousEventPriority: 8,
      unstable_IdleEventPriority: 536870912,
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'View' }));
jest.resetModules();
const App = require('../App').default;
const api = require('@unif/react-native-umeng');
const Fabric = require('react-native/Libraries/Renderer/implementations/ReactFabric-dev');
const nativeBoundary = require('react-native/react-private-interface');
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function find(nodes: any[], predicate: (node: any) => boolean): any {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const child = find(node.children, predicate);
    if (child) return child;
  }
  return undefined;
}
function control(label: string, callback = 'onPress') {
  const result = find(
    nativeBoundary.roots.get(201),
    (node) =>
      (node.props?.accessibilityLabel === label ||
        node.props?.label === label ||
        node.props?.title === label) &&
      typeof node.props?.[callback] === 'function'
  );
  expect(result).toBeDefined();
  return result.props;
}
it('renders setup-to-home transitions using the shipped synchronous Fabric root', async () => {
  jest.mocked(api.initializeUmeng).mockResolvedValue(undefined);
  jest.mocked(api.isUmengInitialized).mockResolvedValue(true);
  jest.mocked(api.getShareTargets).mockResolvedValue([]);
  jest.mocked(api.useShareSheet).mockReturnValue([{ open: jest.fn() }, <></>]);
  const errors: unknown[] = [];
  Fabric.render(<App />, 201, undefined, false, {
    onUncaughtError: (error: unknown) => errors.push(error),
    onCaughtError: (error: unknown) => errors.push(error),
  });
  await tick();
  await tick();
  expect(errors).toEqual([]);
  control('Umeng AppKey', 'onChangeText').onChangeText('native-root-key');
  control('确认配置').onPress();
  await tick();
  expect(errors).toEqual([]);
  expect(
    nativeBoundary.commits.some((nodes: any[]) =>
      find(nodes, (node) => node.props?.accessibilityLabel === '正在确认配置')
    )
  ).toBe(true);
  control('同意隐私政策', 'onChange').onChange(true);
  control('同意并初始化').onPress();
  await tick();
  await tick();
  expect(errors).toEqual([]);
  expect(api.initializeUmeng).toHaveBeenCalledWith({
    appKey: 'native-root-key',
  });
  expect(
    find(
      nativeBoundary.roots.get(201),
      (node) => node.props?.title === '分享展厅'
    )
  ).toBeDefined();
  Fabric.unmountComponentAtNode(201);
  await tick();
});

it('routes synchronous native mount failure through React error handling', async () => {
  jest.mocked(api.useShareSheet).mockReturnValue([{ open: jest.fn() }, <></>]);
  const errors: unknown[] = [];
  Fabric.render(<App />, 201, undefined, false, {
    onUncaughtError: (error: unknown) => errors.push(error),
    onCaughtError: (error: unknown) => errors.push(error),
  });
  await tick();
  await tick();
  control('Umeng AppKey', 'onChangeText').onChangeText('native-root-key');
  nativeBoundary.failAfter = 2;
  control('确认配置').onPress();
  await tick();
  await tick();
  expect(errors).toEqual([
    expect.objectContaining({ message: 'native mount failure' }),
  ]);
  expect(nativeBoundary.roots.get(201)).toEqual([]);
  Fabric.unmountComponentAtNode(201);
  await tick();
});
