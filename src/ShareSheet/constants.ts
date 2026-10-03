import type { SheetState } from './types';

export const INITIAL_SHEET_STATE: SheetState = {
  sessionId: null,
  phase: 'closed',
  content: null,
  options: {},
  platforms: [],
};
