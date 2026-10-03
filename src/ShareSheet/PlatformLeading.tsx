import { View } from 'react-native';
import { useTheme } from '@unif/react-native-design';
import type { PlatformLeadingProps } from './types';
import { platformLeadingStyles as styles } from './styles';
import { WeChatGlyph } from './WeChatGlyph';
import { DingTalkGlyph } from './DingTalkGlyph';

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

  if (platform === 'wechat_session') {
    return (
      <View
        style={[
          styles.container,
          styles.wechat,
          {
            width: size,
            height: size,
          },
        ]}
      >
        <WeChatGlyph size={Math.round(size * 0.5625)} />
      </View>
    );
  }
  if (platform === 'dingtalk') {
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
