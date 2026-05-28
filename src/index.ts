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
} from './types';

export { ShareSheetHost } from './ShareSheet/ShareSheetHost';
