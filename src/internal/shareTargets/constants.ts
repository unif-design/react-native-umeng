import type { ShareTarget } from '../../types';
export const SHARE_TARGET_LABELS: Readonly<Record<ShareTarget, string>> = {
  wechat_session: '微信',
  dingtalk: '钉钉',
};
export const SHARE_TARGET_SUBTITLES: Readonly<Record<ShareTarget, string>> = {
  wechat_session: '发送给好友或群',
  dingtalk: '发送至工作群',
};
