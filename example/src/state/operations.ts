import { SHARE_TARGETS, SHARE_TARGET_LABELS } from '../content/constants';
import {
  type ShareTarget,
  type ShareTargetInfo,
  type ShareSheetOptions,
} from '@unif/react-native-umeng';

import type { ShareContentDraft } from '../content/shareContent';
import type { OperationFeedback } from '../errors/classifyUmengError';

export type DirectShareType = 'text' | 'image' | 'link';

export type SheetDraft = ShareContentDraft & {
  readonly type: DirectShareType;
  readonly options: {
    readonly title: string;
    readonly cancelText: string;
    readonly wechatSubtitle: string;
    readonly dingtalkSubtitle: string;
    readonly hideUninstalled: boolean;
    readonly presentation: 'modal' | 'floating';
  };
};

export type PlatformFreshness = 'fresh' | 'stale';

export type PlatformStatus = ShareTargetInfo & {
  readonly freshness: PlatformFreshness;
};

export type PlatformState = {
  readonly items: readonly PlatformStatus[];
  readonly refreshing: boolean;
  readonly checking: readonly ShareTarget[];
  readonly feedback: OperationFeedback | null;
  readonly activeRefreshRequestId: number | null;
  readonly latestRequestIds: Readonly<Partial<Record<ShareTarget, number>>>;
  readonly feedbackRequestId: number | null;
};

export type PlatformAction =
  | { readonly type: 'refreshStarted'; readonly requestId: number }
  | {
      readonly type: 'refreshSucceeded';
      readonly requestId: number;
      readonly items: readonly ShareTargetInfo[];
    }
  | {
      readonly type: 'refreshFailed';
      readonly requestId: number;
      readonly feedback: OperationFeedback;
    }
  | {
      readonly type: 'checkStarted';
      readonly requestId: number;
      readonly target: ShareTarget;
    }
  | {
      readonly type: 'checkSucceeded';
      readonly requestId: number;
      readonly target: ShareTarget;
      readonly installed: boolean;
    }
  | {
      readonly type: 'checkFailed';
      readonly requestId: number;
      readonly target: ShareTarget;
      readonly feedback: OperationFeedback;
    };

export function createInitialPlatformState(): PlatformState {
  return {
    items: [],
    refreshing: false,
    checking: [],
    feedback: null,
    activeRefreshRequestId: null,
    latestRequestIds: {},
    feedbackRequestId: null,
  };
}

function orderPlatformStatuses(
  items: readonly PlatformStatus[]
): readonly PlatformStatus[] {
  return SHARE_TARGETS.flatMap((target) => {
    const item = items.find((candidate) => candidate.target === target);
    return item === undefined ? [] : [item];
  });
}

function updateCheckedPlatform(
  items: readonly PlatformStatus[],
  target: ShareTarget,
  installed: boolean
): readonly PlatformStatus[] {
  if (items.some((item) => item.target === target)) {
    return items.map((item) =>
      item.target === target ? { ...item, installed, freshness: 'fresh' } : item
    );
  }

  return orderPlatformStatuses([
    ...items,
    {
      target,
      installed,
      label: SHARE_TARGET_LABELS[target],
      freshness: 'fresh',
    },
  ]);
}

function markAllPlatformsStale(
  items: readonly PlatformStatus[],
  latestRequestIds: PlatformState['latestRequestIds'],
  requestId: number
): readonly PlatformStatus[] {
  return items.map((item) =>
    latestRequestIds[item.target] !== requestId || item.freshness === 'stale'
      ? item
      : { ...item, freshness: 'stale' }
  );
}

function markPlatformStale(
  items: readonly PlatformStatus[],
  target: ShareTarget
): readonly PlatformStatus[] {
  return items.map((item) =>
    item.target === target && item.freshness !== 'stale'
      ? { ...item, freshness: 'stale' }
      : item
  );
}

function withRefreshRequest(
  latestRequestIds: PlatformState['latestRequestIds'],
  requestId: number
): PlatformState['latestRequestIds'] {
  return SHARE_TARGETS.reduce<Partial<Record<ShareTarget, number>>>(
    (requests, target) => ({
      ...requests,
      [target]: requestId,
    }),
    { ...latestRequestIds }
  );
}

function mergeRefreshItems(
  currentItems: readonly PlatformStatus[],
  refreshedItems: readonly ShareTargetInfo[],
  latestRequestIds: PlatformState['latestRequestIds'],
  requestId: number
): readonly PlatformStatus[] {
  return SHARE_TARGETS.flatMap((target) => {
    if (latestRequestIds[target] !== requestId) {
      const current = currentItems.find((item) => item.target === target);
      return current === undefined ? [] : [current];
    }

    const refreshed = refreshedItems.find((item) => item.target === target);
    return refreshed === undefined
      ? []
      : [{ ...refreshed, freshness: 'fresh' as const }];
  });
}

function removeCheckingPlatform(
  checking: readonly ShareTarget[],
  target: ShareTarget
): readonly ShareTarget[] {
  return checking.filter((candidate) => candidate !== target);
}

function assertNever(_action: never): never {
  throw new Error('未知平台状态操作');
}

export function platformReducer(
  state: PlatformState,
  action: PlatformAction
): PlatformState {
  switch (action.type) {
    case 'refreshStarted':
      return {
        ...state,
        refreshing: true,
        checking: [],
        feedback: null,
        activeRefreshRequestId: action.requestId,
        latestRequestIds: withRefreshRequest(
          state.latestRequestIds,
          action.requestId
        ),
        feedbackRequestId: action.requestId,
      };
    case 'refreshSucceeded': {
      if (state.activeRefreshRequestId !== action.requestId) {
        return state;
      }

      return {
        ...state,
        items: mergeRefreshItems(
          state.items,
          action.items,
          state.latestRequestIds,
          action.requestId
        ),
        refreshing: false,
        feedback:
          state.feedbackRequestId === action.requestId ? null : state.feedback,
        activeRefreshRequestId: null,
      };
    }
    case 'refreshFailed': {
      if (state.activeRefreshRequestId !== action.requestId) {
        return state;
      }

      return {
        ...state,
        items: markAllPlatformsStale(
          state.items,
          state.latestRequestIds,
          action.requestId
        ),
        refreshing: false,
        feedback:
          state.feedbackRequestId === action.requestId
            ? action.feedback
            : state.feedback,
        activeRefreshRequestId: null,
      };
    }
    case 'checkStarted':
      return {
        ...state,
        checking: state.checking.includes(action.target)
          ? state.checking
          : [...state.checking, action.target],
        feedback: null,
        latestRequestIds: {
          ...state.latestRequestIds,
          [action.target]: action.requestId,
        },
        feedbackRequestId: action.requestId,
      };
    case 'checkSucceeded': {
      if (state.latestRequestIds[action.target] !== action.requestId) {
        return state;
      }

      return {
        ...state,
        items: updateCheckedPlatform(
          state.items,
          action.target,
          action.installed
        ),
        checking: removeCheckingPlatform(state.checking, action.target),
        feedback:
          state.feedbackRequestId === action.requestId ? null : state.feedback,
      };
    }
    case 'checkFailed': {
      if (state.latestRequestIds[action.target] !== action.requestId) {
        return state;
      }

      return {
        ...state,
        items: markPlatformStale(state.items, action.target),
        checking: removeCheckingPlatform(state.checking, action.target),
        feedback:
          state.feedbackRequestId === action.requestId
            ? action.feedback
            : state.feedback,
      };
    }
    default:
      return assertNever(action);
  }
}

export function buildShareSheetOptions(draft: SheetDraft): ShareSheetOptions {
  return {
    title: draft.options.title,
    cancelText: draft.options.cancelText,
    subtitles: {
      ['wechat_session']: draft.options.wechatSubtitle,
      ['dingtalk']: draft.options.dingtalkSubtitle,
    },
    hideUninstalled: draft.options.hideUninstalled,
    presentation: draft.options.presentation,
  };
}
