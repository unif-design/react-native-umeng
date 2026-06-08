// @unif/react-native-umeng 公共 API:Common(初始化)/ Share(微信分享)/ Analytics(友盟统计)。
export * as Common from './common';
export * as Share from './share';
export * as Analytics from './analytics';

export {
  Platform,
  SUPPORTED_PLATFORMS,
  PLATFORM_DISPLAY_NAMES,
  PLATFORM_DEFAULT_SUBTITLES,
  PLATFORM_BRAND_COLORS,
  UmengError,
} from './types';

export type {
  ShareCode,
  ShareResult,
  ErrorCode,
  PlatformInfo,
  ShareTextOptions,
  ShareImageOptions,
  ShareLinkOptions,
  ShareSheetPayload,
  ShareSheetOptions,
  UmengInitConfig,
} from './types';

export { ShareSheetHost } from './ShareSheet/ShareSheetHost';
