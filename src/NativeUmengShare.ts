import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface NativeShareResult {
  code: string; // 'success' | 'cancel' | 'failed'
  message?: string;
  platform: string;
}

export interface Spec extends TurboModule {
  shareText(platform: string, text: string): Promise<NativeShareResult>;
  shareImage(
    platform: string,
    image: string,
    thumb?: string
  ): Promise<NativeShareResult>;
  shareLink(
    platform: string,
    title: string,
    url: string,
    description?: string,
    thumb?: string
  ): Promise<NativeShareResult>;
  isInstalled(platform: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('UmengShare');
