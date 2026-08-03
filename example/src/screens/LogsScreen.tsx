import {
  Card,
  IconButton,
  Tag,
  useThemedStyles,
  type ColorTokens,
  type TagVariant,
} from '@unif/react-native-design';
import { Text, View } from 'react-native';

import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { DemoLogLevel } from '../state/logs';
import { useShowcase } from '../state/useShowcase';

const makeStyles = (colors: ColorTokens) => ({
  list: {
    gap: 12,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginBottom: 8,
  },
  meta: {
    color: colors.foregroundMuted,
    fontSize: 11,
  },
  body: {
    color: colors.foreground,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  empty: {
    color: colors.foregroundMuted,
    fontSize: 14,
    textAlign: 'center' as const,
    paddingVertical: 32,
  },
});

function logVariant(level: DemoLogLevel): TagVariant {
  switch (level) {
    case 'info':
      return 'info';
    case 'warning':
      return 'outline';
    case 'error':
      return 'error';
  }
}

export function LogsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();

  return (
    <ShowcaseScaffold
      title="运行日志"
      onBack={actions.back}
      right={
        <IconButton
          icon="trash"
          accessibilityLabel="清空日志"
          variant="neutral"
          disabled={state.logs.length === 0}
          onPress={actions.clearLogs}
        />
      }
    >
      {state.logs.length === 0 ? (
        <Text style={styles.empty}>暂无运行日志</Text>
      ) : (
        <View style={styles.list}>
          {state.logs.map((log) => (
            <Card key={log.id} variant="plain">
              <View style={styles.header}>
                <Tag label={log.scope} variant={logVariant(log.level)} />
                <Text style={styles.meta}>{log.timestamp}</Text>
              </View>
              <Text style={styles.body} selectable>
                {log.message}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </ShowcaseScaffold>
  );
}
