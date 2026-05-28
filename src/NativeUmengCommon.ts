import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * 预初始化 (App 启动后立刻调,可在 user 同意《隐私协议》之前)。
   *
   * 行为:
   *   - Android: 调 UMConfigure.preInit(context, appkey, channel) + 注册微信/钉钉
   *     平台 (PlatformConfig.setWeixin / setDing)。**preInit 不上报数据。**
   *   - iOS: 友盟公开 SDK 没有 preInit API,本方法只把 config 存到 native 状态
   *     并跑 UMSocialManager setPlaform (平台配置),实际 UMConfigure.initWithAppkey
   *     推迟到 init() 时跑。
   *
   * config 字段:
   *   - appkey (string, 必填)
   *   - channel (string, 可选)
   *   - wechatAppId / wechatAppSecret / wechatUniversalLink (可选)
   *   - dingtalkAppId (可选)
   */
  preInit(config: Object): Promise<void>;

  /**
   * 正式启动数据采集 (user 同意《隐私协议》之后调)。preInit 必须先调过。
   *
   * 行为:
   *   - Android: 调 UMConfigure.init(context, appkey, channel, ...)
   *   - iOS: 调 UMConfigure.initWithAppkey(appkey, channel)
   *
   * preInit 没调时 reject E_INVALID_OPTIONS。
   */
  init(): Promise<void>;

  isInited(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengCommon');
