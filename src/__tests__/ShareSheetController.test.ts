import {
  ShareSheetController,
  type ControllerEvent,
} from '../ShareSheet/ShareSheetController';
import {
  Platform,
  UmengError,
  type ShareResult,
  type ShareSheetPayload,
} from '../types';
import { deferred } from './fixtures/deferred';

const NO_HOST_MESSAGE =
  'No <ShareSheetHost /> mounted. Mount it once at app root.';
const BUSY_MESSAGE =
  'Another ShareSheet is already open. Dismiss the previous one first.';
const OWNER_UNMOUNTED_MESSAGE =
  'The active <ShareSheetHost /> unmounted before the share completed.';

const PAYLOAD: ShareSheetPayload = { type: 'text', text: 'hi' };
const WECHAT_SUCCESS: ShareResult = {
  code: 'success',
  platform: Platform.WECHAT_SESSION,
};
const DINGTALK_SUCCESS: ShareResult = {
  code: 'success',
  platform: Platform.DINGTALK,
};

function showEvent(
  listener: jest.Mock
): Extract<ControllerEvent, { kind: 'show' }> {
  return listener.mock.calls[0]?.[0] as Extract<
    ControllerEvent,
    { kind: 'show' }
  >;
}

describe('ShareSheetController', () => {
  let controller: ShareSheetController;

  beforeEach(() => {
    controller = new ShareSheetController();
  });

  it('rejects show with the stable no-host error', async () => {
    await expect(controller.show(PAYLOAD)).rejects.toMatchObject({
      code: 'E_UNKNOWN',
      message: NO_HOST_MESSAGE,
    });
  });

  it('recovers after the owner listener throws synchronously', async () => {
    const listenerError = new Error('listener failed');
    let shouldThrow = true;
    let sessionId: number | undefined;
    controller.registerHost((event) => {
      if (event.kind !== 'show') return;
      if (shouldThrow) {
        shouldThrow = false;
        throw listenerError;
      }
      sessionId = event.sessionId;
    });

    await expect(controller.show(PAYLOAD)).rejects.toBe(listenerError);

    const second = controller.show(PAYLOAD);
    const secondOutcome = second.then(
      (value) => ({ status: 'fulfilled', value }) as const,
      (reason: unknown) => ({ status: 'rejected', reason }) as const
    );
    controller.settle(sessionId ?? -1, WECHAT_SUCCESS);

    await expect(secondOutcome).resolves.toEqual({
      status: 'fulfilled',
      value: WECHAT_SUCCESS,
    });
  });

  it('preserves a reentrant session when the previous listener later throws', async () => {
    const listenerError = new Error('listener failed after re-entry');
    let showCount = 0;
    let sessionB!: Promise<ShareResult>;
    let sessionBId: number | undefined;
    controller.registerHost((event) => {
      if (event.kind !== 'show') return;
      showCount += 1;
      if (showCount === 1) {
        controller.settle(event.sessionId, WECHAT_SUCCESS);
        sessionB = controller.show({ type: 'text', text: 'B' });
        throw listenerError;
      }
      if (showCount === 2) {
        sessionBId = event.sessionId;
        return;
      }
      throw new Error('Unexpected third listener call');
    });

    await expect(controller.show(PAYLOAD)).resolves.toEqual(WECHAT_SUCCESS);
    await expect(
      controller.show({ type: 'text', text: 'C' })
    ).rejects.toMatchObject({
      code: 'E_UNKNOWN',
      message: BUSY_MESSAGE,
    });

    controller.settle(sessionBId ?? -1, DINGTALK_SUCCESS);
    await expect(sessionB).resolves.toEqual(DINGTALK_SUCCESS);
  });

  it('rejects a concurrent show with the stable busy error', async () => {
    const listener = jest.fn();
    controller.registerHost(listener);
    const first = controller.show(PAYLOAD);
    const sessionId = showEvent(listener).sessionId;

    await expect(controller.show(PAYLOAD)).rejects.toMatchObject({
      code: 'E_UNKNOWN',
      message: BUSY_MESSAGE,
    });

    controller.dismiss(sessionId);
    await expect(first).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });

  it('chooses the earliest registered host and keeps standby hosts idle', async () => {
    const owner = jest.fn();
    const standby = jest.fn();
    controller.registerHost(owner);
    controller.registerHost(standby);

    const promise = controller.show(PAYLOAD, { title: '分享至 X' });
    const event = showEvent(owner);

    expect(event).toEqual({
      kind: 'show',
      sessionId: expect.any(Number),
      payload: PAYLOAD,
      options: { title: '分享至 X' },
    });
    expect(standby).not.toHaveBeenCalled();

    controller.settle(event.sessionId, WECHAT_SUCCESS);
    await expect(promise).resolves.toEqual(WECHAT_SUCCESS);
  });

  it('promotes the next registered host only after the owner unregisters', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const firstRegistration = controller.registerHost(first);
    controller.registerHost(second);

    firstRegistration.unregister();
    const promise = controller.show(PAYLOAD);
    const event = showEvent(second);

    expect(first).not.toHaveBeenCalled();
    expect(event.kind).toBe('show');

    controller.settle(event.sessionId, WECHAT_SUCCESS);
    await expect(promise).resolves.toEqual(WECHAT_SUCCESS);
  });

  it('rejects immediately when the active owner unregisters', async () => {
    const owner = jest.fn();
    const registration = controller.registerHost(owner);
    const promise = controller.show(PAYLOAD);

    registration.unregister();

    await expect(promise).rejects.toMatchObject({
      code: 'E_UNKNOWN',
      message: OWNER_UNMOUNTED_MESSAGE,
    });
    expect(owner).toHaveBeenCalledTimes(1);
  });

  it('keeps the active session pending when a standby host unregisters', async () => {
    const owner = jest.fn();
    const standby = jest.fn();
    controller.registerHost(owner);
    const standbyRegistration = controller.registerHost(standby);
    const promise = controller.show(PAYLOAD);
    const sessionId = showEvent(owner).sessionId;
    const settlement = deferred<ShareResult>();
    promise.then(settlement.resolve, settlement.reject);

    standbyRegistration.unregister();
    controller.settle(sessionId, WECHAT_SUCCESS);

    await expect(settlement.promise).resolves.toEqual(WECHAT_SUCCESS);
    expect(standby).not.toHaveBeenCalled();
  });

  it('ignores every late mutator from session A after session B opens', async () => {
    const owner = jest.fn();
    controller.registerHost(owner);
    const sessionA = controller.show(PAYLOAD);
    const sessionAId = showEvent(owner).sessionId;
    controller.settle(sessionAId, WECHAT_SUCCESS);
    await expect(sessionA).resolves.toEqual(WECHAT_SUCCESS);

    owner.mockClear();
    const sessionB = controller.show({
      type: 'link',
      title: 'B',
      url: 'https://example.com',
    });
    const sessionBId = showEvent(owner).sessionId;
    owner.mockClear();

    expect(controller.markReady(sessionAId)).toBe(false);
    expect(controller.beginSharing(sessionAId)).toBe(false);
    controller.settle(sessionAId, DINGTALK_SUCCESS);
    controller.settleError(
      sessionAId,
      new UmengError('E_SHARE_FAILED', 'late failure')
    );
    controller.dismiss(sessionAId);

    expect(owner).not.toHaveBeenCalled();
    controller.settle(sessionBId, WECHAT_SUCCESS);
    await expect(sessionB).resolves.toEqual(WECHAT_SUCCESS);
    expect(owner).toHaveBeenCalledTimes(1);
    expect(owner).toHaveBeenCalledWith({
      kind: 'dismiss',
      sessionId: sessionBId,
    });
  });

  it('settles one session only once and ignores listener re-entry', async () => {
    let sessionId = 0;
    const listener = jest.fn((event: ControllerEvent) => {
      if (event.kind === 'dismiss') {
        controller.settleError(
          sessionId,
          new UmengError('E_SHARE_FAILED', 're-entered failure')
        );
      }
    });
    controller.registerHost(listener);
    const promise = controller.show(PAYLOAD);
    sessionId = showEvent(listener).sessionId;
    listener.mockClear();

    controller.settle(sessionId, WECHAT_SUCCESS);
    controller.settle(sessionId, DINGTALK_SUCCESS);

    await expect(promise).resolves.toEqual(WECHAT_SUCCESS);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ kind: 'dismiss', sessionId });
  });

  it('uses beginSharing as a synchronous ready-to-sharing CAS', async () => {
    const listener = jest.fn();
    controller.registerHost(listener);
    const promise = controller.show(PAYLOAD);
    const sessionId = showEvent(listener).sessionId;

    expect(controller.beginSharing(sessionId)).toBe(false);
    expect(controller.markReady(sessionId)).toBe(true);
    expect(controller.markReady(sessionId)).toBe(false);
    expect(controller.beginSharing(sessionId)).toBe(true);
    expect(controller.beginSharing(sessionId)).toBe(false);

    controller.settle(sessionId, WECHAT_SUCCESS);
    await expect(promise).resolves.toEqual(WECHAT_SUCCESS);
  });

  it('ignores dismiss after sharing begins', async () => {
    const listener = jest.fn();
    controller.registerHost(listener);
    const promise = controller.show(PAYLOAD);
    const sessionId = showEvent(listener).sessionId;
    controller.markReady(sessionId);
    controller.beginSharing(sessionId);
    listener.mockClear();

    controller.dismiss(sessionId);

    expect(listener).not.toHaveBeenCalled();
    controller.settle(sessionId, WECHAT_SUCCESS);
    await expect(promise).resolves.toEqual(WECHAT_SUCCESS);
  });

  it.each([
    ['loadingPlatforms', false],
    ['ready', true],
  ] as const)(
    'allows dismiss while the session is %s',
    async (_, markReady) => {
      const listener = jest.fn();
      controller.registerHost(listener);
      const promise = controller.show(PAYLOAD);
      const sessionId = showEvent(listener).sessionId;
      if (markReady) {
        controller.markReady(sessionId);
      }

      controller.dismiss(sessionId);

      await expect(promise).rejects.toMatchObject({
        code: 'E_USER_CANCEL',
        message: 'User cancelled',
        nativeError: { reason: 'cancel' },
      });
      expect(listener).toHaveBeenCalledWith({ kind: 'dismiss', sessionId });
    }
  );
});
