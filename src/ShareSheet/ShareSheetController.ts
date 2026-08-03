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
  resolve: (result: ShareResult) => void;
  reject: (error: UmengError) => void;
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
        if (active?.ownerHostId !== hostId) return;

        this.settleError(
          active.sessionId,
          new UmengError('E_UNKNOWN', OWNER_UNMOUNTED_MESSAGE)
        );
      },
    };
  }

  show(
    payload: ShareSheetPayload,
    options: ShareSheetOptions = {}
  ): Promise<ShareResult> {
    const owner = this.hosts.entries().next();
    if (owner.done) {
      return Promise.reject(new UmengError('E_UNKNOWN', NO_HOST_MESSAGE));
    }
    if (this.active !== null) {
      return Promise.reject(new UmengError('E_UNKNOWN', BUSY_MESSAGE));
    }

    const [ownerHostId, listener] = owner.value;
    const sessionId = this.nextSessionId++;

    return new Promise<ShareResult>((resolve, reject) => {
      this.active = {
        sessionId,
        ownerHostId,
        phase: 'loadingPlatforms',
        resolve,
        reject,
      };
      try {
        listener({ kind: 'show', sessionId, payload, options });
      } catch (error) {
        if (this.active?.sessionId === sessionId) {
          this.active = null;
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

    this.active = null;
    active.resolve(result);
    this.hosts.get(active.ownerHostId)?.({ kind: 'dismiss', sessionId });
  }

  settleError(sessionId: number, error: UmengError): void {
    const active = this.active;
    if (active?.sessionId !== sessionId) return;

    this.active = null;
    active.reject(error);
    this.hosts.get(active.ownerHostId)?.({ kind: 'dismiss', sessionId });
  }

  dismiss(sessionId: number, reason: 'cancel' = 'cancel'): void {
    const active = this.active;
    if (active?.sessionId !== sessionId || active.phase === 'sharing') return;

    this.settleError(
      sessionId,
      new UmengError('E_USER_CANCEL', 'User cancelled', { reason })
    );
  }
}

/** 模块级单例，供 Share.openSheet 与 ShareSheetHost 共用 */
export const shareSheetController = new ShareSheetController();
