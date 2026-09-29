import type { ShareTarget } from '@unif/react-native-umeng';
export const SHARE_TARGETS: readonly ShareTarget[] = [
  'wechat_session',
  'dingtalk',
];
export const SHARE_TARGET_LABELS: Readonly<Record<ShareTarget, string>> = {
  wechat_session: '微信',
  dingtalk: '钉钉',
};
