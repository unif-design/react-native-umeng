import { SHARE_TARGET_LABELS } from '../content/constants';

import {
  createInitialPlatformState,
  platformReducer,
  type PlatformStatus,
} from '../state/operations';

const previousItems: readonly PlatformStatus[] = [
  {
    target: 'wechat_session',
    installed: true,
    label: SHARE_TARGET_LABELS.wechat_session,
    freshness: 'fresh',
  },
  {
    target: 'dingtalk',
    installed: true,
    label: SHARE_TARGET_LABELS.dingtalk,
    freshness: 'fresh',
  },
];

const unknownFeedback = {
  tone: 'error',
  code: 'sdk_failed',
  message: '发生未知错误，请稍后重试',
  restartRequired: false,
} as const;

describe('platformReducer', () => {
  it('stores a successful refresh in SHARE_TARGETS order', () => {
    const loading = platformReducer(createInitialPlatformState(), {
      type: 'refreshStarted',
      requestId: 1,
    });
    const refreshed = platformReducer(loading, {
      type: 'refreshSucceeded',
      requestId: 1,
      items: [
        {
          target: 'dingtalk',
          installed: false,
          label: '钉钉',
        },
        {
          target: 'wechat_session',
          installed: true,
          label: '微信',
        },
      ],
    });

    expect(refreshed).toEqual({
      items: [
        {
          target: 'wechat_session',
          installed: true,
          label: '微信',
          freshness: 'fresh',
        },
        {
          target: 'dingtalk',
          installed: false,
          label: '钉钉',
          freshness: 'fresh',
        },
      ],
      refreshing: false,
      checking: [],
      feedback: null,
      activeRefreshRequestId: null,
      latestRequestIds: {
        ['wechat_session']: 1,
        ['dingtalk']: 1,
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
        target: 'wechat_session',
        installed: true,
        label: '微信',
        freshness: 'stale',
      },
      {
        target: 'dingtalk',
        installed: true,
        label: '钉钉',
        freshness: 'stale',
      },
    ]);
    expect(failed).toMatchObject({
      refreshing: false,
      checking: [],
      feedback: unknownFeedback,
    });
  });

  it('updates only the target returned by a single-target check', () => {
    const previous = {
      ...createInitialPlatformState(),
      items: previousItems,
    };
    const checking = platformReducer(previous, {
      type: 'checkStarted',
      requestId: 1,
      target: 'dingtalk',
    });
    const checked = platformReducer(checking, {
      type: 'checkSucceeded',
      requestId: 1,
      target: 'dingtalk',
      installed: false,
    });

    expect(checked.items).toEqual([
      {
        target: 'wechat_session',
        installed: true,
        label: '微信',
        freshness: 'fresh',
      },
      {
        target: 'dingtalk',
        installed: false,
        label: '钉钉',
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

  it('adds a previously unknown target after a successful check', () => {
    const checked = platformReducer(
      platformReducer(createInitialPlatformState(), {
        type: 'checkStarted',
        requestId: 1,
        target: 'dingtalk',
      }),
      {
        type: 'checkSucceeded',
        requestId: 1,
        target: 'dingtalk',
        installed: true,
      }
    );

    expect(checked.items).toEqual([
      {
        target: 'dingtalk',
        installed: true,
        label: '钉钉',
        freshness: 'fresh',
      },
    ]);
  });

  it('keeps another stale target stale when a previously unknown target succeeds', () => {
    const staleWechat: PlatformStatus = {
      target: 'wechat_session',
      installed: true,
      label: '微信',
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
          target: 'dingtalk',
        }
      ),
      {
        type: 'checkSucceeded',
        requestId: 1,
        target: 'dingtalk',
        installed: true,
      }
    );

    expect(checked.items).toEqual([
      staleWechat,
      {
        target: 'dingtalk',
        installed: true,
        label: '钉钉',
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
      target: 'wechat_session',
    });
    const failed = platformReducer(checking, {
      type: 'checkFailed',
      requestId: 1,
      target: 'wechat_session',
      feedback: unknownFeedback,
    });

    expect(failed.items).toEqual([
      {
        target: 'wechat_session',
        installed: true,
        label: '微信',
        freshness: 'stale',
      },
      {
        target: 'dingtalk',
        installed: true,
        label: '钉钉',
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
      target: 'wechat_session',
    });
    const secondCheck = platformReducer(firstCheck, {
      type: 'checkStarted',
      requestId: 4,
      target: 'wechat_session',
    });
    const checked = platformReducer(secondCheck, {
      type: 'checkSucceeded',
      requestId: 4,
      target: 'wechat_session',
      installed: false,
    });
    expect(
      platformReducer(checked, {
        type: 'checkFailed',
        requestId: 3,
        target: 'wechat_session',
        feedback: unknownFeedback,
      })
    ).toBe(checked);
  });

  it('preserves a newer per-target query when an overlapping refresh completes', () => {
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
      target: 'dingtalk',
    });
    const checked = platformReducer(checking, {
      type: 'checkSucceeded',
      requestId: 2,
      target: 'dingtalk',
      installed: false,
    });
    const refreshed = platformReducer(checked, {
      type: 'refreshSucceeded',
      requestId: 1,
      items: [
        {
          target: 'wechat_session',
          installed: false,
          label: '微信',
        },
        {
          target: 'dingtalk',
          installed: true,
          label: '钉钉',
        },
      ],
    });

    expect(refreshed.items).toEqual([
      {
        target: 'wechat_session',
        installed: false,
        label: '微信',
        freshness: 'fresh',
      },
      {
        target: 'dingtalk',
        installed: false,
        label: '钉钉',
        freshness: 'fresh',
      },
    ]);
  });
});

it('ignores stale successes and rejects an unknown platform action', () => {
  const state = createInitialPlatformState();
  expect(
    platformReducer(state, {
      type: 'refreshSucceeded',
      requestId: 44,
      items: [],
    })
  ).toBe(state);
  expect(
    platformReducer(state, {
      type: 'checkSucceeded',
      requestId: 44,
      target: 'dingtalk',
      installed: true,
    })
  ).toBe(state);
  expect(() => platformReducer(state, { type: 'unknown' } as never)).toThrow(
    '未知平台状态操作'
  );
});

it('retains feedback from a newer independent target when an older request completes', () => {
  let state = platformReducer(
    { ...createInitialPlatformState(), items: previousItems },
    { type: 'checkStarted', target: 'wechat_session', requestId: 1 }
  );
  state = platformReducer(state, {
    type: 'checkStarted',
    target: 'dingtalk',
    requestId: 2,
  });
  state = platformReducer(state, {
    type: 'checkFailed',
    target: 'dingtalk',
    requestId: 2,
    feedback: unknownFeedback,
  });
  const successful = platformReducer(state, {
    type: 'checkSucceeded',
    target: 'wechat_session',
    requestId: 1,
    installed: false,
  });
  expect(successful.feedback).toBe(unknownFeedback);
  expect(successful.items[0]?.installed).toBe(false);
  const failed = platformReducer(state, {
    type: 'checkFailed',
    target: 'wechat_session',
    requestId: 1,
    feedback: { ...unknownFeedback, message: 'older failure' },
  });
  expect(failed.feedback).toBe(unknownFeedback);
  expect(failed.items.every((item) => item.freshness === 'stale')).toBe(true);
});

it('preserves newer per-target state and feedback when an overlapping refresh fails', () => {
  const stale = previousItems.map((item) => ({
    ...item,
    freshness: 'stale' as const,
  }));
  let state = platformReducer(
    { ...createInitialPlatformState(), items: stale },
    { type: 'refreshStarted', requestId: 1 }
  );
  state = platformReducer(state, {
    type: 'checkStarted',
    target: 'dingtalk',
    requestId: 2,
  });
  state = platformReducer(state, {
    type: 'checkFailed',
    target: 'dingtalk',
    requestId: 2,
    feedback: unknownFeedback,
  });
  const failed = platformReducer(state, {
    type: 'refreshFailed',
    requestId: 1,
    feedback: { ...unknownFeedback, message: 'old refresh' },
  });
  expect(failed.feedback).toBe(unknownFeedback);
  expect(failed.items[0]).toBe(stale[0]);
  expect(failed.items[1]).toBe(stale[1]);
  let empty = platformReducer(createInitialPlatformState(), {
    type: 'refreshStarted',
    requestId: 1,
  });
  empty = platformReducer(empty, {
    type: 'checkStarted',
    target: 'dingtalk',
    requestId: 2,
  });
  expect(
    platformReducer(empty, {
      type: 'refreshSucceeded',
      requestId: 1,
      items: [],
    }).items
  ).toEqual([]);
});
