// Exercise the shipped RN renderer as well as react-test-renderer's concurrent
// root. Only the native mounting/UI boundary is replaced; hooks and scheduling
// execute in React Fabric 0.88.0 against the actual controller and host.
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (values: any) => values.ios ?? values.default,
  },
  StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {} },
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
  ...require('./fixtures/designTheme').designTheme,
  useThemedStyles: (make: any) =>
    make({ surface: '#fff', foreground: '#000' }, {}),
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
      completeRoot: (tag: number, children: any[]) => roots.set(tag, children),
      registerEventHandler: () => {},
      unstable_getCurrentEventPriority: () => 32,
      unstable_DiscreteEventPriority: 2,
      unstable_ContinuousEventPriority: 8,
      unstable_IdleEventPriority: 536870912,
    },
  };
});

import { useShareSheet } from '../ShareSheet/useShareSheet';
import type { ShareSheetController } from '../types';
const Fabric = require('react-native/Libraries/Renderer/implementations/ReactFabric-dev');
const nativeBoundary = require('react-native/react-private-interface');
let controller: ShareSheetController;
function Host() {
  const [value, host] = useShareSheet();
  controller = value;
  return host;
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

it('settles and removes a floating sheet on an unbatched legacy Fabric root', async () => {
  const errors: unknown[] = [];
  Fabric.render(<Host />, 101, undefined, false, {
    onUncaughtError: (error: unknown) => errors.push(error),
    onCaughtError: (error: unknown) => errors.push(error),
  });
  await tick();
  await tick();
  expect(errors).toEqual([]);
  expect(controller!).toBeDefined();
  const abort = new AbortController();
  const pending = controller!.open(
    { type: 'text', text: 'legacy root' },
    {
      presentation: 'floating',
      signal: abort.signal,
    }
  );
  await tick();
  await tick();
  expect(errors).toEqual([]);
  expect(nativeBoundary.roots.get(101)).toHaveLength(1);
  abort.abort();
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
  await tick();
  expect(nativeBoundary.roots.get(101)).toEqual([]);
  Fabric.unmountComponentAtNode(101);
  await tick();
  expect(errors).toEqual([]);
});
