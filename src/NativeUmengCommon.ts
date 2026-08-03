import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * user 同意《隐私协议》后执行完整初始化。
   *
   * config 字段:
   *   - appkey (string, 必填)
   *   - channel (string, 可选)
   *   - wechatAppId / wechatAppSecret / wechatUniversalLink (可选)
   *   - dingtalkAppId (可选)
   */
  initialize(config: Object): Promise<void>;

  isInited(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengCommon');
