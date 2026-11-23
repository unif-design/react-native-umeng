import { createElement, Fragment, useState } from 'react';
import { unsupported } from '../internal/errors/unsupported';
import type { ShareSheet, ShareSheetController } from '../types';

export function useShareSheet(): ShareSheet {
  const [controller] = useState<ShareSheetController>(() => ({
    open: () =>
      Promise.resolve({
        status: 'failed',
        error: { reason: 'unsupported', message: unsupported().message },
      }),
  }));
  const [host] = useState(() => createElement(Fragment));
  return [controller, host] as const;
}
