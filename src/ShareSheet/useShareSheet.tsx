import { useState } from 'react';
import type { ShareSheet } from '../types';
import { ShareSheetSession } from './ShareSheetController';
import { ShareSheetHost } from './ShareSheetHost';

export function useShareSheet(): ShareSheet {
  const [controller] = useState(() => new ShareSheetSession());
  const [host] = useState(() => <ShareSheetHost controller={controller} />);
  return [controller, host] as const;
}
