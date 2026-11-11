import { Pressable, Text, View } from 'react-native';
import { useThemedStyles } from '@unif/react-native-design';
import type { SharePanelProps } from '../types';
import { SHARE_TARGET_SUBTITLES } from '../internal/shareTargets';
import { PlatformLeading } from './PlatformLeading';
import { makeSheetStyles } from './styles';

/** 渠道选择展示；查询、内容准备与分享由调用方组合。 */
export function SharePanel({
  targets,
  onSelect,
  title = '分享至',
  subtitles = {},
  hideUninstalled = false,
  disabled = false,
}: SharePanelProps) {
  const styles = useThemedStyles(makeSheetStyles);
  return (
    <View>
      {title ? (
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}
      <View style={styles.platforms}>
        {targets
          .filter((info) => !hideUninstalled || info.installed)
          .map((info) => {
            const description = info.installed
              ? (subtitles[info.target] ?? SHARE_TARGET_SUBTITLES[info.target])
              : '未安装';
            return (
              <Pressable
                key={info.target}
                testID={`umeng-share-cell-${info.target}`}
                accessibilityRole="button"
                accessibilityLabel={`${info.label}，${description}`}
                accessibilityState={{ disabled }}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.platform,
                  (disabled || pressed) && styles.muted,
                ]}
                onPress={disabled ? undefined : () => onSelect(info.target)}
              >
                <PlatformLeading platform={info.target} />
                <Text style={styles.description}>{description}</Text>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}
