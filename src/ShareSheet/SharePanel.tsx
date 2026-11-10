import { Text, View } from 'react-native';
import { Cell, useThemedStyles } from '@unif/react-native-design';
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
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.platforms}>
        {targets
          .filter((info) => !hideUninstalled || info.installed)
          .map((info) => (
            <Cell
              key={info.target}
              testID={`umeng-share-cell-${info.target}`}
              style={styles.platform}
              title={info.label}
              desc={`${subtitles[info.target] ?? SHARE_TARGET_SUBTITLES[info.target]} · ${info.installed ? '已安装' : '未安装'}`}
              leading={{
                kind: 'display',
                node: <PlatformLeading platform={info.target} />,
              }}
              arrow
              disabled={disabled}
              onPress={() => {
                if (!disabled) {
                  onSelect(info.target);
                }
              }}
            />
          ))}
      </View>
    </View>
  );
}
