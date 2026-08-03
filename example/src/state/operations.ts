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
  };
};

export type PlatformFreshness = 'fresh' | 'stale';

export type PlatformStatus = PlatformInfo & {
  readonly freshness: PlatformFreshness;
};

export type PlatformState = {
  readonly items: readonly PlatformStatus[];
  readonly refreshing: boolean;
  readonly checking: Platform | null;
  readonly feedback: OperationFeedback | null;
};

export type PlatformAction =
  | { readonly type: 'refreshStarted' }
  | {
      readonly type: 'refreshSucceeded';
      readonly items: readonly PlatformInfo[];
    }
  | {
      readonly type: 'refreshFailed';
      readonly feedback: OperationFeedback;
    }
  | {
      readonly type: 'checkStarted';
      readonly platform: Platform;
    }
  | {
      readonly type: 'checkSucceeded';
      readonly platform: Platform;
      readonly installed: boolean;
    }
  | {
      readonly type: 'checkFailed';
      readonly platform: Platform;
      readonly feedback: OperationFeedback;
    };

export function createInitialPlatformState(): PlatformState {
  return {
    items: [],
    refreshing: false,
    checking: null,
    feedback: null,
  };
}

function orderPlatformItems(
  items: readonly PlatformInfo[]
): readonly PlatformStatus[] {
  return SUPPORTED_PLATFORMS.flatMap((platform) => {
    const item = items.find((candidate) => candidate.platform === platform);
    return item === undefined ? [] : [{ ...item, freshness: 'fresh' as const }];
  });
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
  items: readonly PlatformStatus[]
): readonly PlatformStatus[] {
  return items.map((item) =>
    item.freshness === 'stale' ? item : { ...item, freshness: 'stale' }
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
        checking: null,
        feedback: null,
      };
    case 'refreshSucceeded':
      return {
        items: orderPlatformItems(action.items),
        refreshing: false,
        checking: null,
        feedback: null,
      };
    case 'refreshFailed':
      return {
        ...state,
        items: markAllPlatformsStale(state.items),
        refreshing: false,
        checking: null,
        feedback: action.feedback,
      };
    case 'checkStarted':
      return {
        ...state,
        checking: action.platform,
        feedback: null,
      };
    case 'checkSucceeded':
      return {
        ...state,
        items: updateCheckedPlatform(
          state.items,
          action.platform,
          action.installed
        ),
        checking: null,
        feedback: null,
      };
    case 'checkFailed':
      return {
        ...state,
        items: markPlatformStale(state.items, action.platform),
        checking: null,
        feedback: action.feedback,
      };
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
  };
}
