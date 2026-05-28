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

/** 各平台官方品牌色，用作 ShareSheet 平台前导小块的实色填充。 */
export const PLATFORM_BRAND_COLORS: Readonly<Record<Platform, string>> = {
  [Platform.WECHAT_SESSION]: '#07C160',
  [Platform.DINGTALK]: '#2595E8',
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

/** 友盟初始化配置。`Common.init(config)` 接收。
 *
 *  PIPL 合规:user 同意《隐私协议》之后才调 `Common.init(config)`,
 *  在那之前 native 完全不持有 appkey,不会调任何友盟 API。 */
export interface UmengInitConfig {
  /** 友盟 appkey,必填 */
  appkey: string;
  /** 渠道标识。默认 iOS = 'App Store',Android = 'default' */
  channel?: string;
  /** 微信平台 appid;不传则不注册微信分享 */
  wechatAppId?: string;
  /** 微信平台 appsecret;有 wechatAppId 才生效 */
  wechatAppSecret?: string;
  /** 微信 Universal Link (1.8.6+ 强制);iOS 才用,有 wechatAppId 才生效 */
  wechatUniversalLink?: string;
  /** 钉钉平台 appid;不传则不注册钉钉分享 */
  dingtalkAppId?: string;
}

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
