import {
  PLATFORM_DISPLAY_NAMES,
  Platform,
  type PlatformInfo,
} from '@unif/react-native-umeng';

import {
  createInitialPlatformState,
  platformReducer,
} from '../state/operations';

const previousItems: readonly PlatformInfo[] = [
  {
    platform: Platform.WECHAT_SESSION,
    installed: true,
    displayName: PLATFORM_DISPLAY_NAMES[Platform.WECHAT_SESSION],
  },
  {
    platform: Platform.DINGTALK,
    installed: true,
    displayName: PLATFORM_DISPLAY_NAMES[Platform.DINGTALK],
  },
];

const unknownFeedback = {
  tone: 'error',
  code: 'E_UNKNOWN',
  message: '发生未知错误，请稍后重试',
  restartRequired: false,
} as const;

describe('platformReducer', () => {
  it('stores a successful refresh in SUPPORTED_PLATFORMS order', () => {
    const loading = platformReducer(createInitialPlatformState(), {
      type: 'refreshStarted',
    });
    const refreshed = platformReducer(loading, {
      type: 'refreshSucceeded',
      items: [
        {
          platform: Platform.DINGTALK,
          installed: false,
          displayName: '钉钉',
        },
        {
          platform: Platform.WECHAT_SESSION,
          installed: true,
          displayName: '微信',
        },
      ],
    });

    expect(refreshed).toEqual({
      items: [
        {
          platform: Platform.WECHAT_SESSION,
          installed: true,
          displayName: '微信',
        },
        {
          platform: Platform.DINGTALK,
          installed: false,
          displayName: '钉钉',
        },
      ],
      refreshing: false,
      checking: null,
      feedback: null,
    });
  });

  it('retains the last trusted items when refresh fails', () => {
    const previous = {
      ...createInitialPlatformState(),
      items: previousItems,
    };
    const loading = platformReducer(previous, { type: 'refreshStarted' });
    const failed = platformReducer(loading, {
      type: 'refreshFailed',
      feedback: unknownFeedback,
    });

    expect(failed.items).toBe(previousItems);
    expect(failed).toMatchObject({
      refreshing: false,
      checking: null,
      feedback: unknownFeedback,
    });
  });

  it('updates only the platform returned by a single-platform check', () => {
    const previous = {
      ...createInitialPlatformState(),
      items: previousItems,
    };
    const checking = platformReducer(previous, {
      type: 'checkStarted',
      platform: Platform.DINGTALK,
    });
    const checked = platformReducer(checking, {
      type: 'checkSucceeded',
      platform: Platform.DINGTALK,
      installed: false,
    });

    expect(checked.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
      },
      {
        platform: Platform.DINGTALK,
        installed: false,
        displayName: '钉钉',
      },
    ]);
    expect(checked.items[0]).toBe(previousItems[0]);
    expect(checked.items[1]).not.toBe(previousItems[1]);
    expect(checked).toMatchObject({
      refreshing: false,
      checking: null,
      feedback: null,
    });
  });

  it('adds a previously unknown platform after a successful check', () => {
    const checked = platformReducer(
      platformReducer(createInitialPlatformState(), {
        type: 'checkStarted',
        platform: Platform.DINGTALK,
      }),
      {
        type: 'checkSucceeded',
        platform: Platform.DINGTALK,
        installed: true,
      }
    );

    expect(checked.items).toEqual([
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
      },
    ]);
  });

  it('does not replace a trusted install state when a check fails', () => {
    const previous = {
      ...createInitialPlatformState(),
      items: previousItems,
    };
    const checking = platformReducer(previous, {
      type: 'checkStarted',
      platform: Platform.WECHAT_SESSION,
    });
    const failed = platformReducer(checking, {
      type: 'checkFailed',
      platform: Platform.WECHAT_SESSION,
      feedback: unknownFeedback,
    });

    expect(failed.items).toBe(previousItems);
    expect(failed).toMatchObject({
      refreshing: false,
      checking: null,
      feedback: unknownFeedback,
    });
  });
});
