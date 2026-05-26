import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  onEvent(eventId: string, params: Object): void;
  signIn(userId: string, provider?: string): void;
  signOut(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengAnalytics');
