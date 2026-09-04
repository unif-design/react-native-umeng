import {
  UmengError,
  type ShareResult,
  type ShareSheetOptions,
  type ShareSheetPayload,
} from '../types';

export type SessionPhase = 'loadingPlatforms' | 'ready' | 'sharing';

export type ControllerEvent =
  | {
      kind: 'show';
      sessionId: number;
      payload: ShareSheetPayload;
      options: ShareSheetOptions;
    }
  | { kind: 'dismiss'; sessionId: number };

export type ControllerListener = (event: ControllerEvent) => void;

interface ActiveSession {
  sessionId: number;
  ownerHostId: number;
  phase: SessionPhase;
  presentationDismissed: boolean;
  onDismiss?: () => void;
  resolve: (result: ShareResult) => void;
  reject: (error: UmengError) => void;
}

interface DismissingSession {
  sessionId: number;
  ownerHostId: number;
  onDismiss?: () => void;
}

const NO_HOST_MESSAGE =
  'No <ShareSheetHost /> mounted. Mount it once at app root.';
const BUSY_MESSAGE =
  'Another ShareSheet is already open. Dismiss the previous one first.';
const OWNER_UNMOUNTED_MESSAGE =
  'The active <ShareSheetHost /> unmounted before the share completed.';

export class ShareSheetController {
  private hosts = new Map<number, ControllerListener>();
  private active: ActiveSession | null = null;
  private dismissing: DismissingSession | null = null;
  private nextHostId = 1;
  private nextSessionId = 1;

  registerHost(listener: ControllerListener): {
    hostId: number;
    unregister(): void;
  } {
    const hostId = this.nextHostId++;
    this.hosts.set(hostId, listener);

    return {
      hostId,
      unregister: () => {
        if (!this.hosts.delete(hostId)) return;

        const active = this.active;
        if (active?.ownerHostId === hostId) {
          this.settleError(
            active.sessionId,
            new UmengError('E_UNKNOWN', OWNER_UNMOUNTED_MESSAGE)
          );
        }
        const dismissing = this.dismissing;
        if (dismissing?.ownerHostId === hostId) {
          this.completeDismiss(dismissing.sessionId);
        }
      },
    };
  }

  show(
    payload: ShareSheetPayload,
    options: ShareSheetOptions = {}
  ): Promise<ShareResult> {
    const owner = Array.from(this.hosts.entries()).pop();
    if (!owner) {
      options.onDismiss?.();
      return Promise.reject(new UmengError('E_UNKNOWN', NO_HOST_MESSAGE));
    }
    if (this.active !== null || this.dismissing !== null) {
      options.onDismiss?.();
      return Promise.reject(new UmengError('E_UNKNOWN', BUSY_MESSAGE));
    }

    const [ownerHostId, listener] = owner;
    const sessionId = this.nextSessionId++;

    return new Promise<ShareResult>((resolve, reject) => {
      this.active = {
        sessionId,
        ownerHostId,
        phase: 'loadingPlatforms',
        presentationDismissed: false,
        onDismiss: options.onDismiss,
        resolve,
        reject,
      };
      try {
        listener({ kind: 'show', sessionId, payload, options });
      } catch (error) {
        if (this.active?.sessionId === sessionId) {
          const onDismiss = this.active.onDismiss;
          this.active = null;
          onDismiss?.();
        }
        reject(error);
      }
    });
  }

  markReady(sessionId: number): boolean {
    const active = this.active;
    if (
      active?.sessionId !== sessionId ||
      active.phase !== 'loadingPlatforms'
    ) {
      return false;
    }

    active.phase = 'ready';
    return true;
  }

  beginSharing(sessionId: number): boolean {
    const active = this.active;
    if (active?.sessionId !== sessionId || active.phase !== 'ready') {
      return false;
    }

    active.phase = 'sharing';
    return true;
  }

  settle(sessionId: number, result: ShareResult): void {
    const active = this.active;
    if (active?.sessionId !== sessionId) return;

    this.prepareDismiss(active);
    active.resolve(result);
    this.notifyHostDismiss(active);
  }

  settleError(sessionId: number, error: UmengError): void {
    const active = this.active;
    if (active?.sessionId !== sessionId) return;

    this.prepareDismiss(active);
    active.reject(error);
    this.notifyHostDismiss(active);
  }

  completeDismiss(sessionId: number): void {
    const active = this.active;
    if (active?.sessionId === sessionId) {
      active.presentationDismissed = true;
      const onDismiss = active.onDismiss;
      active.onDismiss = undefined;
      onDismiss?.();
      return;
    }

    const dismissing = this.dismissing;
    if (dismissing?.sessionId !== sessionId) return;
    this.dismissing = null;
    dismissing.onDismiss?.();
  }

  private prepareDismiss(active: ActiveSession): void {
    this.active = null;
    if (active.presentationDismissed) return;
    this.dismissing = {
      sessionId: active.sessionId,
      ownerHostId: active.ownerHostId,
      onDismiss: active.onDismiss,
    };
  }

  private notifyHostDismiss(active: ActiveSession): void {
    const listener = this.hosts.get(active.ownerHostId);
    if (listener) {
      listener({ kind: 'dismiss', sessionId: active.sessionId });
    } else {
      this.completeDismiss(active.sessionId);
    }
  }

  dismiss(sessionId: number, reason: 'cancel' = 'cancel'): void {
    const active = this.active;
    if (active?.sessionId !== sessionId) return;

    this.settleError(
      sessionId,
      new UmengError('E_USER_CANCEL', 'User cancelled', { reason })
    );
  }
}

/** 模块级单例，供 Share.openSheet 与 ShareSheetHost 共用 */
export const shareSheetController = new ShareSheetController();
