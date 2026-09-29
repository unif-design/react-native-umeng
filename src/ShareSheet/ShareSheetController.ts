import { toFailure } from '../internal/errors';
import {
  invalidInput,
  isShareTarget,
  requireObject,
  requireString,
  snapshotContent,
} from '../internal/shareContent';
import type {
  ShareContent,
  ShareResult,
  ShareSheetCallOptions,
  ShareSheetController,
} from '../types';

import type { ShareSheetListener, PendingShareSheetSession } from './types';

function notify(callback?: () => void): void {
  try {
    callback?.();
  } catch {
    /* Presentation observers cannot replace an operation result. */
  }
}
function snapshotOptions(value: unknown): ShareSheetCallOptions {
  if (value === undefined) return {};
  const input = requireObject(value, 'options');
  for (const key of ['title', 'cancelText'])
    if (input[key] !== undefined) requireString(input[key], key);
  if (
    input.hideUninstalled !== undefined &&
    typeof input.hideUninstalled !== 'boolean'
  )
    invalidInput('hideUninstalled must be a boolean');
  if (
    input.presentation !== undefined &&
    input.presentation !== 'modal' &&
    input.presentation !== 'floating'
  )
    invalidInput('presentation must be modal or floating');
  for (const key of ['onLayout', 'onDismiss'])
    if (input[key] !== undefined && typeof input[key] !== 'function')
      invalidInput(`${key} must be a function`);
  if (input.subtitles !== undefined) {
    for (const [target, subtitle] of Object.entries(
      requireObject(input.subtitles, 'subtitles')
    )) {
      if (!isShareTarget(target))
        invalidInput('subtitles contains an unsupported target');
      requireString(subtitle, 'subtitle');
    }
  }
  if (input.signal !== undefined) {
    const signal = requireObject(input.signal, 'signal');
    if (
      typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' ||
      typeof signal.removeEventListener !== 'function'
    )
      invalidInput('signal must be an AbortSignal');
  }
  const options = value as ShareSheetCallOptions;
  return {
    ...options,
    ...(options.subtitles === undefined
      ? {}
      : { subtitles: { ...options.subtitles } }),
  };
}

/** One hook's presentation and pending result; never registered in a global host table. */
export class ShareSheetSession implements ShareSheetController {
  private listener: ShareSheetListener | null = null;
  private active: PendingShareSheetSession | null = null;
  private dismissing: PendingShareSheetSession | null = null;
  private sequence = 0;

  attach(listener: ShareSheetListener): () => void {
    this.listener = listener;
    return () => {
      if (this.listener !== listener) return;
      this.listener = null;
      const session = this.active ?? this.dismissing;
      if (!session) return;
      this.dismiss(session.id);
      this.completeDismiss(session.id);
    };
  }
  open(
    content: Readonly<ShareContent>,
    options?: ShareSheetCallOptions
  ): Promise<ShareResult> {
    try {
      const snapshot = snapshotContent(content);
      const callOptions = snapshotOptions(options);
      if (this.active || this.dismissing)
        return Promise.resolve({
          status: 'failed',
          error: {
            reason: 'busy',
            message: 'This share sheet already has a pending call',
          },
        });
      if (!this.listener)
        return Promise.resolve({
          status: 'failed',
          error: {
            reason: 'unavailable',
            message:
              'Render the host returned by this useShareSheet instance before opening it',
          },
        });
      if (callOptions.signal?.aborted)
        return Promise.resolve({ status: 'cancelled' });
      const id = ++this.sequence;
      return new Promise((resolve) => {
        const onAbort = () => this.dismiss(id);
        this.active = {
          id,
          phase: 'loading',
          dismissed: false,
          onDismiss: callOptions.onDismiss,
          resolve,
          stopListening: () =>
            callOptions.signal?.removeEventListener('abort', onAbort),
        };
        callOptions.signal?.addEventListener('abort', onAbort, { once: true });
        this.listener?.({
          kind: 'show',
          sessionId: id,
          content: snapshot,
          options: callOptions,
        });
      });
    } catch (error) {
      return Promise.resolve({
        status: 'failed',
        error: toFailure(error, 'Failed to open share sheet'),
      });
    }
  }
  markReady(id: number): boolean {
    if (this.active?.id !== id || this.active.phase !== 'loading') return false;
    this.active.phase = 'ready';
    return true;
  }
  isPresenting(id: number | null): boolean {
    return (
      this.active?.id === id &&
      this.active.phase === 'ready' &&
      !this.active.dismissed
    );
  }
  beginSharing(id: number): boolean {
    if (this.active?.id !== id || this.active.phase !== 'ready') return false;
    this.active.phase = 'sharing';
    this.hide(this.active);
    return true;
  }
  settle(id: number, result: ShareResult): void {
    const session = this.active;
    if (session?.id !== id) return;
    this.active = null;
    session.stopListening();
    if (!session.dismissed) this.dismissing = session;
    session.resolve(result);
    this.hide(session);
  }
  dismiss(id: number): void {
    const session = this.active;
    if (session?.id !== id) return;
    if (session.phase === 'sharing') this.hide(session);
    else this.settle(id, { status: 'cancelled' });
  }
  completeDismiss(id: number): void {
    const session =
      this.active?.id === id
        ? this.active
        : this.dismissing?.id === id
          ? this.dismissing
          : null;
    if (!session || session.dismissed) return;
    session.dismissed = true;
    if (this.dismissing === session) this.dismissing = null;
    notify(session.onDismiss);
  }
  private hide(session: PendingShareSheetSession): void {
    if (session.dismissed) return;
    if (this.listener)
      this.listener({ kind: 'dismiss', sessionId: session.id });
    else this.completeDismiss(session.id);
  }
}
