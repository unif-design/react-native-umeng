// @unif/react-native-umeng 公共 API:Common(初始化)/ Share(微信分享)/ Analytics(友盟统计)。
// 文档站:https://unif-design.github.io/react-native-umeng/(版本随发版自动部署)。
import * as Common from './common';
import * as Share from './share';
import * as Analytics from './analytics';

export { Common, Share, Analytics };

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
