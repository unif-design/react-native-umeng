import NativeUmengCommon from './NativeUmengCommon';
import NativeUmengShare from './NativeUmengShare';
import { normalizeError, toFailure, unavailable } from './internal/errors';
import {
  isShareTarget,
  requireObject,
  snapshotContent,
  invalidInput,
} from './internal/shareContent';
import { SHARE_TARGET_LABELS } from './internal/shareTargets';
import { UmengError } from './UmengError';
import type {
  ShareTarget,
  ShareTargetInfo,
  ShareRequest,
  ShareResult,
} from './types';

async function configuredTargets(): Promise<readonly ShareTarget[]> {
  if (!NativeUmengCommon) throw unavailable();
  const value: unknown = await NativeUmengCommon.getConfiguredShareTargets();
  if (
    !Array.isArray(value) ||
    !Array.from(value).every(isShareTarget) ||
    new Set(value).size !== value.length
  ) {
    throw new UmengError({
      reason: 'invalid_response',
      message: 'Native returned invalid share targets',
    });
  }
  return value;
}
async function installed(target: ShareTarget): Promise<boolean> {
  if (!NativeUmengShare) throw unavailable();
  const value: unknown = await NativeUmengShare.isInstalled(target);
  if (typeof value !== 'boolean')
    throw new UmengError({
      reason: 'invalid_response',
      message: 'Native returned invalid installation state',
    });
  return value;
}
export async function getShareTargets(): Promise<readonly ShareTargetInfo[]> {
  try {
    const targets = await configuredTargets();
    return await Promise.all(
      targets.map(async (target) => ({
        target,
        label: SHARE_TARGET_LABELS[target],
        installed: await installed(target),
      }))
    );
  } catch (error) {
    throw normalizeError(error, 'sdk_failed', 'Failed to query share targets');
  }
}
function nativeResult(value: unknown, target: ShareTarget): ShareResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UmengError({
      reason: 'invalid_response',
      message: 'Native share returned an invalid receipt',
    });
  }
  const result = value as Record<string, unknown>;
  if (
    result.platform !== target ||
    !['success', 'cancel', 'failed'].includes(String(result.code)) ||
    (result.message !== undefined && typeof result.message !== 'string')
  ) {
    throw new UmengError({
      reason: 'invalid_response',
      message: 'Native share returned a mismatched or invalid receipt',
    });
  }
  if (result.code === 'success') return { status: 'success', target };
  if (result.code === 'cancel') return { status: 'cancelled', target };
  return {
    status: 'failed',
    target,
    error: {
      reason: 'sdk_failed',
      message:
        typeof result.message === 'string' && result.message.trim()
          ? result.message
          : 'Share failed',
    },
  };
}

// One SDK channel, independent from the lifetime of any presentation instance.
let sharing = false;
export async function share(
  input: Readonly<ShareRequest>
): Promise<ShareResult> {
  let target: ShareTarget | undefined;
  let ownsChannel = false;
  try {
    const request = requireObject(input, 'input');
    if (!isShareTarget(request.target))
      return invalidInput('target must be wechat_session or dingtalk');
    target = request.target;
    const content = snapshotContent(request.content);
    if (sharing)
      throw new UmengError({
        reason: 'busy',
        message: 'Another native share is still in progress',
      });
    sharing = true;
    ownsChannel = true;
    if (!(await configuredTargets()).includes(target)) {
      throw new UmengError({
        reason: 'not_initialized',
        message: `${SHARE_TARGET_LABELS[target]} has not been configured`,
      });
    }
    if (!(await installed(target)))
      throw new UmengError({
        reason: 'not_installed',
        message: `${SHARE_TARGET_LABELS[target]} 未安装`,
      });
    if (!NativeUmengShare) throw unavailable();
    let receipt: unknown;
    switch (content.type) {
      case 'text':
        receipt = await NativeUmengShare.shareText(target, content.text);
        break;
      case 'image':
        receipt = await NativeUmengShare.shareImage(
          target,
          content.imageUrl,
          content.thumbnailUrl
        );
        break;
      case 'link':
        receipt = await NativeUmengShare.shareLink(
          target,
          content.title,
          content.url,
          content.description,
          content.thumbnailUrl
        );
        break;
    }
    return nativeResult(receipt, target);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'E_USER_CANCEL'
    )
      return {
        status: 'cancelled',
        ...(target === undefined ? {} : { target }),
      };
    return {
      status: 'failed',
      ...(target === undefined ? {} : { target }),
      error: toFailure(error, 'Failed to share'),
    };
  } finally {
    if (ownsChannel) sharing = false;
  }
}
