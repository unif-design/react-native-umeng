export interface NormalizedUmengInitConfig {
  readonly appkey: string;
  readonly channel: string | undefined;
  readonly wechatAppId: string | undefined;
  readonly wechatAppSecret: string | undefined;
  readonly wechatUniversalLink: string | undefined;
  readonly dingtalkAppId: string | undefined;
}

export type InitConfigInput = Record<string, unknown>;
