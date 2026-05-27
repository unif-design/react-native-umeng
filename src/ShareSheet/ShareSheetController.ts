import {
  UmengError,
  type ShareResult,
  type ShareSheetOptions,
  type ShareSheetPayload,
} from '../types';

export type ControllerEvent =
  | { kind: 'show'; payload: ShareSheetPayload; options: ShareSheetOptions }
  | { kind: 'dismiss' };

type Listener = (e: ControllerEvent) => void;

interface PendingShow {
  resolve: (r: ShareResult) => void;
  reject: (e: UmengError) => void;
}

export class ShareSheetController {
  private listeners: Set<Listener> = new Set();
  private pending: PendingShow | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(
    payload: ShareSheetPayload,
    options: ShareSheetOptions = {}
  ): Promise<ShareResult> {
    return new Promise<ShareResult>((resolve, reject) => {
      if (this.listeners.size === 0) {
        reject(
          new UmengError(
            'E_UNKNOWN',
            'No <ShareSheetHost /> mounted. Mount it once at app root.'
          )
        );
        return;
      }
      if (this.pending !== null) {
        reject(
          new UmengError(
            'E_UNKNOWN',
            'Another ShareSheet is already open. Dismiss the previous one first.'
          )
        );
        return;
      }
      this.pending = { resolve, reject };
      this.emit({ kind: 'show', payload, options });
    });
  }

  /** Host 在分享 success 时调；resolve openSheet Promise */
  settle(result: ShareResult): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.resolve(result);
    this.emit({ kind: 'dismiss' });
  }

  /** Host 在 cancel / failed 时调；reject openSheet Promise */
  settleError(err: UmengError): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    p.reject(err);
    this.emit({ kind: 'dismiss' });
  }

  /** 用户主动取消 / 取消按钮 / scrim 点击 */
  dismiss(reason: 'cancel' = 'cancel'): void {
    if (!this.pending) return;
    this.settleError(
      new UmengError('E_USER_CANCEL', 'User cancelled', { reason })
    );
  }

  private emit(e: ControllerEvent): void {
    for (const l of this.listeners) l(e);
  }
}

/** 模块级单例，供 Share.openSheet 与 ShareSheetHost 共用 */
export const shareSheetController = new ShareSheetController();
