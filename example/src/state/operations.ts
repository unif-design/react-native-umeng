import {
  PLATFORM_DISPLAY_NAMES,
  Platform,
  SUPPORTED_PLATFORMS,
  type PlatformInfo,
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

export type PlatformStatus = PlatformInfo & {
  readonly freshness: PlatformFreshness;
};

export type PlatformState = {
  readonly items: readonly PlatformStatus[];
  readonly refreshing: boolean;
  readonly checking: readonly Platform[];
  readonly feedback: OperationFeedback | null;
  readonly activeRefreshRequestId: number | null;
  readonly latestRequestIds: Readonly<Partial<Record<Platform, number>>>;
  readonly feedbackRequestId: number | null;
};

export type PlatformAction =
  | { readonly type: 'refreshStarted'; readonly requestId: number }
  | {
      readonly type: 'refreshSucceeded';
      readonly requestId: number;
      readonly items: readonly PlatformInfo[];
    }
  | {
      readonly type: 'refreshFailed';
      readonly requestId: number;
      readonly feedback: OperationFeedback;
    }
  | {
      readonly type: 'checkStarted';
      readonly requestId: number;
      readonly platform: Platform;
    }
  | {
      readonly type: 'checkSucceeded';
      readonly requestId: number;
      readonly platform: Platform;
      readonly installed: boolean;
    }
  | {
      readonly type: 'checkFailed';
      readonly requestId: number;
      readonly platform: Platform;
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
  return SUPPORTED_PLATFORMS.flatMap((platform) => {
    const item = items.find((candidate) => candidate.platform === platform);
    return item === undefined ? [] : [item];
  });
}

function updateCheckedPlatform(
  items: readonly PlatformStatus[],
  platform: Platform,
  installed: boolean
): readonly PlatformStatus[] {
  if (items.some((item) => item.platform === platform)) {
    return items.map((item) =>
      item.platform === platform
        ? { ...item, installed, freshness: 'fresh' }
        : item
    );
  }

  return orderPlatformStatuses([
    ...items,
    {
      platform,
      installed,
      displayName: PLATFORM_DISPLAY_NAMES[platform],
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
    latestRequestIds[item.platform] !== requestId || item.freshness === 'stale'
      ? item
      : { ...item, freshness: 'stale' }
  );
}

function markPlatformStale(
  items: readonly PlatformStatus[],
  platform: Platform
): readonly PlatformStatus[] {
  return items.map((item) =>
    item.platform === platform && item.freshness !== 'stale'
      ? { ...item, freshness: 'stale' }
      : item
  );
}

function withRefreshRequest(
  latestRequestIds: PlatformState['latestRequestIds'],
  requestId: number
): PlatformState['latestRequestIds'] {
  return SUPPORTED_PLATFORMS.reduce<Partial<Record<Platform, number>>>(
    (requests, platform) => ({
      ...requests,
      [platform]: requestId,
    }),
    { ...latestRequestIds }
  );
}

function mergeRefreshItems(
  currentItems: readonly PlatformStatus[],
  refreshedItems: readonly PlatformInfo[],
  latestRequestIds: PlatformState['latestRequestIds'],
  requestId: number
): readonly PlatformStatus[] {
  return SUPPORTED_PLATFORMS.flatMap((platform) => {
    if (latestRequestIds[platform] !== requestId) {
      const current = currentItems.find((item) => item.platform === platform);
      return current === undefined ? [] : [current];
    }

    const refreshed = refreshedItems.find((item) => item.platform === platform);
    return refreshed === undefined
      ? []
      : [{ ...refreshed, freshness: 'fresh' as const }];
  });
}

function removeCheckingPlatform(
  checking: readonly Platform[],
  platform: Platform
): readonly Platform[] {
  return checking.filter((candidate) => candidate !== platform);
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
        checking: state.checking.includes(action.platform)
          ? state.checking
          : [...state.checking, action.platform],
        feedback: null,
        latestRequestIds: {
          ...state.latestRequestIds,
          [action.platform]: action.requestId,
        },
        feedbackRequestId: action.requestId,
      };
    case 'checkSucceeded': {
      if (state.latestRequestIds[action.platform] !== action.requestId) {
        return state;
      }

      return {
        ...state,
        items: updateCheckedPlatform(
          state.items,
          action.platform,
          action.installed
        ),
        checking: removeCheckingPlatform(state.checking, action.platform),
        feedback:
          state.feedbackRequestId === action.requestId ? null : state.feedback,
      };
    }
    case 'checkFailed': {
      if (state.latestRequestIds[action.platform] !== action.requestId) {
        return state;
      }

      return {
        ...state,
        items: markPlatformStale(state.items, action.platform),
        checking: removeCheckingPlatform(state.checking, action.platform),
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
      [Platform.WECHAT_SESSION]: draft.options.wechatSubtitle,
      [Platform.DINGTALK]: draft.options.dingtalkSubtitle,
    },
    hideUninstalled: draft.options.hideUninstalled,
    presentation: draft.options.presentation,
  };
}
