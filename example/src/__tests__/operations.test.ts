import { PLATFORM_DISPLAY_NAMES, Platform } from '@unif/react-native-umeng';

import {
  createInitialPlatformState,
  platformReducer,
  type PlatformStatus,
} from '../state/operations';

const previousItems: readonly PlatformStatus[] = [
  {
    platform: Platform.WECHAT_SESSION,
    installed: true,
    displayName: PLATFORM_DISPLAY_NAMES[Platform.WECHAT_SESSION],
    freshness: 'fresh',
  },
  {
    platform: Platform.DINGTALK,
    installed: true,
    displayName: PLATFORM_DISPLAY_NAMES[Platform.DINGTALK],
    freshness: 'fresh',
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
      requestId: 1,
    });
    const refreshed = platformReducer(loading, {
      type: 'refreshSucceeded',
      requestId: 1,
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
          freshness: 'fresh',
        },
        {
          platform: Platform.DINGTALK,
          installed: false,
          displayName: '钉钉',
          freshness: 'fresh',
        },
      ],
      refreshing: false,
      checking: [],
      feedback: null,
      activeRefreshRequestId: null,
      latestRequestIds: {
        [Platform.WECHAT_SESSION]: 1,
        [Platform.DINGTALK]: 1,
      },
      feedbackRequestId: 1,
    });
  });

  it('retains last-known install values but marks every item stale when refresh fails', () => {
    const previous = {
      ...createInitialPlatformState(),
      items: previousItems,
    };
    const loading = platformReducer(previous, {
      type: 'refreshStarted',
      requestId: 1,
    });
    const failed = platformReducer(loading, {
      type: 'refreshFailed',
      requestId: 1,
      feedback: unknownFeedback,
    });

    expect(failed.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
        freshness: 'stale',
      },
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
        freshness: 'stale',
      },
    ]);
    expect(failed).toMatchObject({
      refreshing: false,
      checking: [],
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
      requestId: 1,
      platform: Platform.DINGTALK,
    });
    const checked = platformReducer(checking, {
      type: 'checkSucceeded',
      requestId: 1,
      platform: Platform.DINGTALK,
      installed: false,
    });

    expect(checked.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
        freshness: 'fresh',
      },
      {
        platform: Platform.DINGTALK,
        installed: false,
        displayName: '钉钉',
        freshness: 'fresh',
      },
    ]);
    expect(checked.items[0]).toBe(previousItems[0]);
    expect(checked.items[1]).not.toBe(previousItems[1]);
    expect(checked).toMatchObject({
      refreshing: false,
      checking: [],
      feedback: null,
    });
  });

  it('adds a previously unknown platform after a successful check', () => {
    const checked = platformReducer(
      platformReducer(createInitialPlatformState(), {
        type: 'checkStarted',
        requestId: 1,
        platform: Platform.DINGTALK,
      }),
      {
        type: 'checkSucceeded',
        requestId: 1,
        platform: Platform.DINGTALK,
        installed: true,
      }
    );

    expect(checked.items).toEqual([
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
        freshness: 'fresh',
      },
    ]);
  });

  it('keeps another stale platform stale when a previously unknown target succeeds', () => {
    const staleWechat: PlatformStatus = {
      platform: Platform.WECHAT_SESSION,
      installed: true,
      displayName: '微信',
      freshness: 'stale',
    };
    const checked = platformReducer(
      platformReducer(
        {
          ...createInitialPlatformState(),
          items: [staleWechat],
        },
        {
          type: 'checkStarted',
          requestId: 1,
          platform: Platform.DINGTALK,
        }
      ),
      {
        type: 'checkSucceeded',
        requestId: 1,
        platform: Platform.DINGTALK,
        installed: true,
      }
    );

    expect(checked.items).toEqual([
      staleWechat,
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
        freshness: 'fresh',
      },
    ]);
    expect(checked.items[0]).toBe(staleWechat);
  });

  it('retains the last-known install value but marks the failed target stale', () => {
    const previous = {
      ...createInitialPlatformState(),
      items: previousItems,
    };
    const checking = platformReducer(previous, {
      type: 'checkStarted',
      requestId: 1,
      platform: Platform.WECHAT_SESSION,
    });
    const failed = platformReducer(checking, {
      type: 'checkFailed',
      requestId: 1,
      platform: Platform.WECHAT_SESSION,
      feedback: unknownFeedback,
    });

    expect(failed.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: true,
        displayName: '微信',
        freshness: 'stale',
      },
      {
        platform: Platform.DINGTALK,
        installed: true,
        displayName: '钉钉',
        freshness: 'fresh',
      },
    ]);
    expect(failed).toMatchObject({
      refreshing: false,
      checking: [],
      feedback: unknownFeedback,
    });
  });

  it('returns the same state for stale refresh and check completions', () => {
    const firstRefresh = platformReducer(createInitialPlatformState(), {
      type: 'refreshStarted',
      requestId: 1,
    });
    const secondRefresh = platformReducer(firstRefresh, {
      type: 'refreshStarted',
      requestId: 2,
    });
    const refreshed = platformReducer(secondRefresh, {
      type: 'refreshSucceeded',
      requestId: 2,
      items: previousItems,
    });
    expect(
      platformReducer(refreshed, {
        type: 'refreshFailed',
        requestId: 1,
        feedback: unknownFeedback,
      })
    ).toBe(refreshed);

    const firstCheck = platformReducer(refreshed, {
      type: 'checkStarted',
      requestId: 3,
      platform: Platform.WECHAT_SESSION,
    });
    const secondCheck = platformReducer(firstCheck, {
      type: 'checkStarted',
      requestId: 4,
      platform: Platform.WECHAT_SESSION,
    });
    const checked = platformReducer(secondCheck, {
      type: 'checkSucceeded',
      requestId: 4,
      platform: Platform.WECHAT_SESSION,
      installed: false,
    });
    expect(
      platformReducer(checked, {
        type: 'checkFailed',
        requestId: 3,
        platform: Platform.WECHAT_SESSION,
        feedback: unknownFeedback,
      })
    ).toBe(checked);
  });

  it('preserves a newer per-platform query when an overlapping refresh completes', () => {
    const refreshing = platformReducer(
      {
        ...createInitialPlatformState(),
        items: previousItems,
      },
      {
        type: 'refreshStarted',
        requestId: 1,
      }
    );
    const checking = platformReducer(refreshing, {
      type: 'checkStarted',
      requestId: 2,
      platform: Platform.DINGTALK,
    });
    const checked = platformReducer(checking, {
      type: 'checkSucceeded',
      requestId: 2,
      platform: Platform.DINGTALK,
      installed: false,
    });
    const refreshed = platformReducer(checked, {
      type: 'refreshSucceeded',
      requestId: 1,
      items: [
        {
          platform: Platform.WECHAT_SESSION,
          installed: false,
          displayName: '微信',
        },
        {
          platform: Platform.DINGTALK,
          installed: true,
          displayName: '钉钉',
        },
      ],
    });

    expect(refreshed.items).toEqual([
      {
        platform: Platform.WECHAT_SESSION,
        installed: false,
        displayName: '微信',
        freshness: 'fresh',
      },
      {
        platform: Platform.DINGTALK,
        installed: false,
        displayName: '钉钉',
        freshness: 'fresh',
      },
    ]);
  });
});
