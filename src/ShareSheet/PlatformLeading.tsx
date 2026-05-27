import { View, StyleSheet } from 'react-native';
import { useTheme } from '@unif/react-native-design';
import { PLATFORM_BRAND_COLORS, Platform } from '../types';
import { WeChatGlyph } from './WeChatGlyph';
import { DingTalkGlyph } from './DingTalkGlyph';

export interface PlatformLeadingProps {
  platform: Platform;
  size?: number;
}

/**
 * 32×32 圆角 8 容器:
 *   微信 → 实色 #07C160 + 白色 SimpleIcons glyph
 *   钉钉 → surface-container 浅色 + 多色官方 logo
 */
export const PlatformLeading = ({
  platform,
  size = 32,
}: PlatformLeadingProps) => {
  const theme = useTheme();

  if (platform === Platform.WECHAT_SESSION) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: PLATFORM_BRAND_COLORS[Platform.WECHAT_SESSION],
          },
        ]}
      >
        <WeChatGlyph size={Math.round(size * 0.5625)} />
      </View>
    );
  }
  if (platform === Platform.DINGTALK) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: theme.colors.surfaceContainer,
          },
        ]}
      >
        <DingTalkGlyph size={Math.round(size * 0.6875)} />
      </View>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
