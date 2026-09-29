import type { ReactElement } from 'react';

export type ShareTarget = 'wechat_session' | 'dingtalk';
export interface WeChatConfiguration {
  appId: string;
  appSecret: string;
  universalLink?: string;
}
export interface DingTalkConfiguration {
  appId: string;
}
export interface UmengConfiguration {
  appKey: string;
  channel?: string;
  wechat?: WeChatConfiguration;
  dingtalk?: DingTalkConfiguration;
}
export interface UmengFailure {
  reason:
    | 'invalid_input'
    | 'configuration_locked'
    | 'not_initialized'
    | 'not_installed'
    | 'busy'
    | 'sdk_failed'
    | 'invalid_response'
    | 'unavailable'
    | 'unsupported';
  message: string;
  sourceCode?: string;
}
export interface ShareTargetInfo {
  target: ShareTarget;
  installed: boolean;
  label: string;
}
export interface ShareTextContent {
  type: 'text';
  text: string;
}
export interface ShareImageContent {
  type: 'image';
  imageUrl: string;
  thumbnailUrl?: string;
}
export interface ShareLinkContent {
  type: 'link';
  title: string;
  url: string;
  description?: string;
  thumbnailUrl?: string;
}
export type ShareContent =
  | ShareTextContent
  | ShareImageContent
  | ShareLinkContent;
export interface ShareRequest {
  target: ShareTarget;
  content: ShareContent;
}
export interface ShareSucceeded {
  status: 'success';
  target: ShareTarget;
}
export interface ShareCancelled {
  status: 'cancelled';
  target?: ShareTarget;
}
export interface ShareFailed {
  status: 'failed';
  target?: ShareTarget;
  error: UmengFailure;
}
export type ShareResult = ShareSucceeded | ShareCancelled | ShareFailed;
export interface ShareSheetOptions {
  title?: string;
  cancelText?: string;
  hideUninstalled?: boolean;
  subtitles?: Partial<Record<ShareTarget, string>>;
  presentation?: 'modal' | 'floating';
  onLayout?(height: number): void;
  onDismiss?(): void;
}
export interface ShareSheetCallOptions extends ShareSheetOptions {
  signal?: AbortSignal;
}
export interface ShareSheetController {
  open(
    content: Readonly<ShareContent>,
    options?: ShareSheetCallOptions
  ): Promise<ShareResult>;
}
export type ShareSheet = readonly [ShareSheetController, ReactElement];
export interface AnalyticsEvent {
  name: string;
  attributes?: Readonly<Record<string, string | number>>;
}
export interface AnalyticsUser {
  userId: string;
  provider?: string;
}
