import { ShareSheetController } from '../ShareSheet/ShareSheetController';
import { Platform } from '../types';
import type { ShareSheetPayload, ShareSheetOptions } from '../types';

describe('ShareSheetController', () => {
  let controller: ShareSheetController;
  beforeEach(() => {
    controller = new ShareSheetController();
  });

  it('show() returns a pending Promise that rejects on dismiss', () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    const payload: ShareSheetPayload = { type: 'text', text: 'hi' };
    const p = controller.show(payload);
    expect(p).toBeInstanceOf(Promise);
    controller.dismiss('cancel');
    return expect(p).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });

  it('subscribers receive show event with payload + options', () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    const payload: ShareSheetPayload = { type: 'link', title: 'T', url: 'u' };
    const opts: ShareSheetOptions = { title: '分享至 X' };
    controller.show(payload, opts).catch(() => {});
    expect(listener).toHaveBeenCalledWith({
      kind: 'show',
      payload,
      options: opts,
    });
  });

  it('settle(result) resolves the in-flight Promise', async () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    const p = controller.show({ type: 'text', text: 'hi' });
    controller.settle({ code: 'success', platform: Platform.WECHAT_SESSION });
    await expect(p).resolves.toEqual({
      code: 'success',
      platform: Platform.WECHAT_SESSION,
    });
  });

  it('rejects when controller has no host subscriber', () => {
    const fresh = new ShareSheetController();
    return expect(
      fresh.show({ type: 'text', text: 'hi' })
    ).rejects.toMatchObject({ code: 'E_UNKNOWN' });
  });

  it('subscriber removal stops receiving events', () => {
    const listener = jest.fn();
    const unsub = controller.subscribe(listener);
    unsub();
    controller.show({ type: 'text', text: 'hi' }).catch(() => {});
    expect(listener).not.toHaveBeenCalled();
  });

  it('only one show at a time — second show rejects immediately', async () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    const p1 = controller.show({ type: 'text', text: '1' });
    const p2 = controller.show({ type: 'text', text: '2' });
    await expect(p2).rejects.toMatchObject({ code: 'E_UNKNOWN' });
    controller.dismiss('cancel');
    await expect(p1).rejects.toMatchObject({ code: 'E_USER_CANCEL' });
  });

  it('emits dismiss event on settle', () => {
    const listener = jest.fn();
    controller.subscribe(listener);
    controller.show({ type: 'text', text: 'hi' }).catch(() => {});
    listener.mockClear();
    controller.settle({ code: 'success', platform: Platform.WECHAT_SESSION });
    expect(listener).toHaveBeenCalledWith({ kind: 'dismiss' });
  });
});
