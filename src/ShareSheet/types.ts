import type {
  ShareContent,
  ShareResult,
  ShareSheetCallOptions,
  ShareSheetOptions,
  ShareTarget,
  ShareTargetInfo,
} from '../types';
import type { ShareSheetSession } from './ShareSheetController';

export interface ShareSheetShowEvent {
  kind: 'show';
  sessionId: number;
  content: Readonly<ShareContent>;
  options: ShareSheetCallOptions;
}
export interface ShareSheetDismissEvent {
  kind: 'dismiss';
  sessionId: number;
}
export type ShareSheetEvent = ShareSheetShowEvent | ShareSheetDismissEvent;
export type ShareSheetListener = (event: ShareSheetEvent) => void;
export interface PendingShareSheetSession {
  id: number;
  phase: 'loading' | 'ready' | 'sharing';
  dismissed: boolean;
  onDismiss?: () => void;
  stopListening(): void;
  resolve(result: ShareResult): void;
}
export interface SheetState {
  sessionId: number | null;
  phase: 'closed' | 'loadingPlatforms' | 'ready' | 'sharing';
  content: Readonly<ShareContent> | null;
  options: ShareSheetOptions;
  platforms: readonly ShareTargetInfo[];
}
export interface ShareSheetHostProps {
  controller: ShareSheetSession;
}
export interface PlatformLeadingProps {
  platform: ShareTarget;
  size?: number;
}
