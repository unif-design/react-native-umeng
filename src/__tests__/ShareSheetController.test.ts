import { ShareSheetSession } from '../ShareSheet/ShareSheetController';
const content = { type: 'text', text: 'original' } as const;

it('requires its own host and keeps separate instances independent', async () => {
  expect(ShareSheetSession).toEqual(expect.any(Function));
  const first = new ShareSheetSession();
  const second = new ShareSheetSession();
  await expect(first.open(content)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unavailable' },
  });
  const events: number[] = [];
  first.attach((event) => {
    if (event.kind === 'show') events.push(event.sessionId);
  });
  const pending = first.open(content);
  await expect(first.open(content)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'busy' },
  });
  await expect(second.open(content)).resolves.toMatchObject({
    status: 'failed',
    error: { reason: 'unavailable' },
  });
  first.dismiss(events[0]!);
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
});

it('snapshots content and cancels selection when its signal aborts', async () => {
  expect(ShareSheetSession).toEqual(expect.any(Function));
  const session = new ShareSheetSession();
  let shown: unknown;
  let id = 0;
  session.attach((event) => {
    if (event.kind === 'show') {
      shown = event.content;
      id = event.sessionId;
    }
  });
  const signal = new AbortController();
  const onDismiss = jest.fn();
  const input = { type: 'text' as const, text: 'original' };
  const pending = session.open(input, { signal: signal.signal, onDismiss });
  input.text = 'changed';
  expect(shown).toEqual(content);
  signal.abort();
  await expect(pending).resolves.toEqual({ status: 'cancelled' });
  session.completeDismiss(id);
  session.completeDismiss(id);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('keeps a vendor result after abort and host unmount, without updating a new presentation', async () => {
  expect(ShareSheetSession).toEqual(expect.any(Function));
  const session = new ShareSheetSession();
  let id = 0;
  const detach = session.attach((event) => {
    if (event.kind === 'show') id = event.sessionId;
  });
  const signal = new AbortController();
  const onDismiss = jest.fn(() => {
    throw new Error('observer');
  });
  const pending = session.open(content, { signal: signal.signal, onDismiss });
  session.markReady(id);
  expect(session.beginSharing(id)).toBe(true);
  signal.abort();
  detach();
  const result = { status: 'success', target: 'wechat_session' } as const;
  session.settle(id, result);
  await expect(pending).resolves.toEqual(result);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  const nextEvents: number[] = [];
  session.attach((event) => {
    if (event.kind === 'show') nextEvents.push(event.sessionId);
  });
  const next = session.open(content);
  session.settle(id, result);
  session.dismiss(nextEvents[0]!);
  await expect(next).resolves.toEqual({ status: 'cancelled' });
});

it('allows two hosts to present independently and dismiss only their own call', async () => {
  const first = new ShareSheetSession();
  const second = new ShareSheetSession();
  let firstId = 0;
  let secondId = 0;
  const firstDismissed = jest.fn();
  const secondDismissed = jest.fn();
  const firstDetach = first.attach((event) => {
    if (event.kind === 'show') firstId = event.sessionId;
  });
  const secondDetach = second.attach((event) => {
    if (event.kind === 'show') secondId = event.sessionId;
  });
  const firstResult = first.open(content, { onDismiss: firstDismissed });
  const secondResult = second.open(content, { onDismiss: secondDismissed });
  expect(first.markReady(firstId)).toBe(true);
  expect(second.markReady(secondId)).toBe(true);
  firstDetach();
  await expect(firstResult).resolves.toEqual({ status: 'cancelled' });
  expect(firstDismissed).toHaveBeenCalledTimes(1);
  expect(second.isPresenting(secondId)).toBe(true);
  expect(secondDismissed).not.toHaveBeenCalled();
  expect(second.beginSharing(secondId)).toBe(true);
  secondDetach();
  const result = { status: 'success', target: 'dingtalk' } as const;
  second.settle(secondId, result);
  await expect(secondResult).resolves.toEqual(result);
  expect(secondDismissed).toHaveBeenCalledTimes(1);
});
