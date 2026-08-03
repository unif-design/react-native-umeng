import {
  EntryCard,
  Grid,
  useThemedStyles,
  type ColorTokens,
  type GridItem,
} from '@unif/react-native-design';
import { Text, View } from 'react-native';

import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { RouteId } from '../navigation';
import { useShowcase } from '../state/useShowcase';

type HomeGridItem = GridItem & {
  readonly id: Exclude<RouteId, 'setup' | 'home'>;
};

const HOME_ITEMS: HomeGridItem[] = [
  { id: 'platforms', icon: 'grid', label: '平台状态' },
  { id: 'sheet', icon: 'share', label: '分享面板' },
  { id: 'direct', icon: 'send', label: '直接分享' },
  { id: 'analytics', icon: 'dashboard-star', label: 'Analytics' },
  { id: 'logs', icon: 'list', label: '运行日志' },
];

const makeStyles = (colors: ColorTokens) => ({
  intro: {
    color: colors.foregroundMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  summary: {
    gap: 10,
  },
});

export function HomeScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();

  return (
    <ShowcaseScaffold title="分享展厅" subtitle="@unif/react-native-umeng">
      <View style={styles.summary}>
        <EntryCard
          icon="shield-check"
          title="初始化完成"
          sub={`${state.platforms.items.length} 个平台状态已载入`}
        />
        <Text style={styles.intro}>
          选择一个场景验证平台检测、分享面板、直接分享、Analytics 与安全日志。
        </Text>
      </View>
      <Grid
        items={HOME_ITEMS}
        columns={2}
        onPress={(item) => {
          actions.navigate(item.id as HomeGridItem['id']);
        }}
      />
    </ShowcaseScaffold>
  );
}
