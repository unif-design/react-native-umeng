/** 本桥首版支持的分享目标平台 */
export enum Platform {
  WECHAT_SESSION = 'wechat_session',
  DINGTALK = 'dingtalk',
}

/** 默认渲染顺序 */
export const SUPPORTED_PLATFORMS: ReadonlyArray<Platform> = [
  Platform.WECHAT_SESSION,
  Platform.DINGTALK,
];

export interface PlatformInfo {
  platform: Platform;
  installed: boolean;
  displayName: string;
}

export const PLATFORM_DISPLAY_NAMES: Readonly<Record<Platform, string>> = {
  [Platform.WECHAT_SESSION]: '微信',
  [Platform.DINGTALK]: '钉钉',
};

export const PLATFORM_DEFAULT_SUBTITLES: Readonly<Record<Platform, string>> = {
  [Platform.WECHAT_SESSION]: '发送给好友或群',
  [Platform.DINGTALK]: '发送至工作群',
};

export type ShareCode = 'success' | 'cancel' | 'failed';

export interface ShareResult {
  code: ShareCode;
  message?: string;
  platform: Platform;
}

export type ErrorCode =
  | 'E_PLATFORM_NOT_INSTALLED'
  | 'E_PLATFORM_NOT_SUPPORTED'
  | 'E_INVALID_OPTIONS'
  | 'E_USER_CANCEL'
  | 'E_SHARE_FAILED'
  | 'E_NOT_INITIALIZED'
  | 'E_UNKNOWN';

export class UmengError extends Error {
  readonly code: ErrorCode;
  readonly nativeError?: unknown;
  constructor(code: ErrorCode, message: string, nativeError?: unknown) {
    super(message);
    this.name = 'UmengError';
    this.code = code;
    this.nativeError = nativeError;
  }
}

export interface ShareTextOptions {
  platform: Platform;
  text: string;
}

export interface ShareImageOptions {
  platform: Platform;
  image: string;
  thumb?: string;
}

export interface ShareLinkOptions {
  platform: Platform;
  title: string;
  url: string;
  description?: string;
  thumb?: string;
}

export type ShareSheetPayload =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; thumb?: string }
  | {
      type: 'link';
      title: string;
      url: string;
      description?: string;
      thumb?: string;
    };

export interface ShareSheetOptions {
  /** 面板标题，默认 '分享至' */
  title?: string;
  /** 取消按钮文案，默认 '取消' */
  cancelText?: string;
  /** 平台副标题覆盖；默认见 PLATFORM_DEFAULT_SUBTITLES */
  subtitles?: Partial<Record<Platform, string>>;
  /** 未安装平台隐藏；默认 false（按钮置灰） */
  hideUninstalled?: boolean;
}
