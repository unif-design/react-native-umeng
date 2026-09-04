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

export type ShareCode = 'success';

export interface ShareResult {
  code: 'success';
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

/** 友盟预初始化配置，仅传给 JS 的 `Common.preInit(config)`；`Common.init()` 无参。 */
export interface UmengInitConfig {
  /** 友盟 appkey,必填 */
  appkey: string;
  /** 渠道标识。默认 iOS = 'App Store',Android = 'default' */
  channel?: string;
  /** 微信平台 appid;启用微信时须与 wechatAppSecret 同时提供 */
  wechatAppId?: string;
  /** 微信平台 appsecret;启用微信时须与 wechatAppId 同时提供 */
  wechatAppSecret?: string;
  /** 带 host 的绝对 HTTPS Universal Link;iOS 启用微信时必填,Android 可选 */
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
  /** 未安装平台隐藏；默认 false（仍显示且可点击，点击后 reject 未安装错误） */
  hideUninstalled?: boolean;
  /** 面板呈现方式；floating 无遮罩且允许面板外触摸穿透，默认 modal。 */
  presentation?: 'modal' | 'floating';
  /** 面板布局高度变化时回调，可用于为下层可滚动内容预留真实空间。 */
  onSheetLayout?: (height: number) => void;
  /** 面板完全退场后回调；未展示面板的失败会直接回调。 */
  onDismiss?: () => void;
}
