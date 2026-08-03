import {
  Button,
  Card,
  StatusDot,
  Tag,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import {
  PLATFORM_DISPLAY_NAMES,
  SUPPORTED_PLATFORMS,
  type Platform,
} from '@unif/react-native-umeng';
import { Text, View } from 'react-native';

import { OperationFeedback } from '../components/OperationFeedback';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import { useShowcase } from '../state/useShowcase';

const makeStyles = (colors: ColorTokens) => ({
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 12,
  },
  name: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
  },
});

function installationPresentation(installed: boolean | undefined): {
  readonly label: string;
  readonly status: 'pending' | 'done' | 'error';
  readonly variant: 'neutral' | 'success' | 'error';
} {
  if (installed === undefined) {
    return { label: '待检测', status: 'pending', variant: 'neutral' };
  }
  return installed
    ? { label: '已安装', status: 'done', variant: 'success' }
    : { label: '未安装', status: 'error', variant: 'error' };
}

export function PlatformsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();
  const platformState = state.platforms;

  return (
    <ShowcaseScaffold title="平台状态" onBack={actions.back}>
      <Button
        label="刷新平台列表"
        leftIcon="refresh"
        variant="secondary"
        block
        loading={platformState.refreshing}
        onPress={() => {
          actions.refreshPlatforms();
        }}
      />
      <OperationFeedback feedback={platformState.feedback ?? state.feedback} />
      <View style={styles.list}>
        {SUPPORTED_PLATFORMS.map((platform: Platform) => {
          const item = platformState.items.find(
            (candidate) => candidate.platform === platform
          );
          const displayName =
            item?.displayName ?? PLATFORM_DISPLAY_NAMES[platform];
          const presentation = installationPresentation(item?.installed);
          const checking = platformState.checking === platform;
          const stale = item?.freshness === 'stale';

          return (
            <Card key={platform}>
              <View style={styles.row}>
                <StatusDot
                  status={presentation.status}
                  accessibilityLabel={`${displayName}${presentation.label}${
                    stale ? '，需复查' : ''
                  }`}
                />
                <Text style={styles.name}>{displayName}</Text>
                <Tag
                  label={presentation.label}
                  variant={presentation.variant}
                />
                {stale ? <Tag label="需复查" variant="outline" /> : null}
              </View>
              <Button
                label={`重新检测${displayName}`}
                variant="outline"
                block
                loading={checking}
                onPress={() => {
                  actions.checkPlatform(platform);
                }}
              />
            </Card>
          );
        })}
      </View>
    </ShowcaseScaffold>
  );
}
