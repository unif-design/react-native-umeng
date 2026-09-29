import type { UmengFailure } from '@unif/react-native-umeng';

export const FAILURE_MESSAGES: Record<UmengFailure['reason'], string> = {
  invalid_input: '请检查输入后重试',
  configuration_locked: '初始化已开始，修改配置需要重启 App',
  not_initialized: '请先完成目标平台初始化',
  not_installed: '目标平台未安装，请安装后重试',
  busy: '上一项分享尚未结束',
  sdk_failed: '未取得 SDK 成功回执，请检查后重试',
  invalid_response: 'SDK 回执无效，分享结果未确认',
  unavailable: '当前宿主不可用',
  unsupported: '当前平台不支持此操作',
};
