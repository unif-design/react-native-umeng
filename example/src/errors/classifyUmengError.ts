import { UmengError, type ErrorCode } from '@unif/react-native-umeng';

export type OperationScope =
  | 'preInit'
  | 'init'
  | 'platform'
  | 'share'
  | 'analytics';

export type OperationFeedback = {
  tone: 'neutral' | 'warning' | 'error';
  code: ErrorCode | 'E_NON_UMENG';
  message: string;
  restartRequired: boolean;
};

function assertNever(code: never): never {
  throw new Error(`未覆盖的 Umeng ErrorCode: ${code}`);
}

function classifyKnownError(
  code: ErrorCode,
  scope: OperationScope
): OperationFeedback {
  switch (code) {
    case 'E_USER_CANCEL':
      return {
        tone: 'neutral',
        code,
        message: '已取消分享',
        restartRequired: false,
      };
    case 'E_PLATFORM_NOT_INSTALLED':
      return {
        tone: 'warning',
        code,
        message: '目标平台未安装，请安装后重试',
        restartRequired: false,
      };
    case 'E_INVALID_OPTIONS':
      return scope === 'init'
        ? {
            tone: 'warning',
            code,
            message: '初始化已开始，修改配置需要重启 App',
            restartRequired: true,
          }
        : {
            tone: 'warning',
            code,
            message: '请检查输入后重试',
            restartRequired: false,
          };
    case 'E_SHARE_FAILED':
      return {
        tone: 'error',
        code,
        message: '分享失败，请重试',
        restartRequired: false,
      };
    case 'E_PLATFORM_NOT_SUPPORTED':
      return {
        tone: 'error',
        code,
        message:
          scope === 'init'
            ? '初始化失败，可使用同一配置重试；若持续失败请重启 App'
            : '当前分享平台不受支持',
        restartRequired: scope === 'init',
      };
    case 'E_NOT_INITIALIZED':
      return {
        tone: 'warning',
        code,
        message: '请先完成初始化',
        restartRequired: false,
      };
    case 'E_UNKNOWN':
      return {
        tone: 'error',
        code,
        message:
          scope === 'init'
            ? '初始化失败，可使用同一配置重试；若持续失败请重启 App'
            : '发生未知错误，请稍后重试',
        restartRequired: scope === 'init',
      };
    default:
      return assertNever(code);
  }
}

export function classifyUmengError(
  error: unknown,
  scope: OperationScope
): OperationFeedback {
  if (error instanceof UmengError) {
    return classifyKnownError(error.code, scope);
  }

  return {
    tone: 'error',
    code: 'E_NON_UMENG',
    message:
      scope === 'init'
        ? '初始化失败，可使用同一配置重试；若持续失败请重启 App'
        : '发生未识别错误，请稍后重试',
    restartRequired: scope === 'init',
  };
}
