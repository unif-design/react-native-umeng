import {
  Button,
  Card,
  StatusDot,
  Switch,
  Tag,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { Text, View } from 'react-native';

import { CredentialForm } from '../components/CredentialForm';
import { OperationFeedback } from '../components/OperationFeedback';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import { useShowcase } from '../state/useShowcase';

const makeStyles = (colors: ColorTokens) => ({
  description: {
    color: colors.foregroundMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  consentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 16,
  },
  consentCopy: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
});

function setupStatus(phase: string): {
  readonly label: string;
  readonly status: 'pending' | 'active' | 'done' | 'error';
} {
  switch (phase) {
    case 'editing':
      return { label: '等待运行时配置', status: 'pending' };
    case 'preInitializing':
      return { label: '正在预初始化', status: 'active' };
    case 'awaitingConsent':
      return { label: '等待隐私同意', status: 'pending' };
    case 'initializing':
      return { label: '正在初始化', status: 'active' };
    case 'initialized':
      return { label: '初始化完成', status: 'done' };
    case 'initFailedLocked':
      return { label: '初始化失败', status: 'error' };
    default:
      return { label: '未知状态', status: 'error' };
  }
}

export function SetupScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();
  const setup = state.setup;
  const status = setupStatus(setup.phase);
  const editing =
    setup.phase === 'editing' || setup.phase === 'preInitializing';
  const awaitingConsent =
    setup.phase === 'awaitingConsent' || setup.phase === 'initializing';

  return (
    <ShowcaseScaffold title="合规初始化" subtitle="凭据仅保存在本次运行内存中">
      <Card variant="plain">
        <View style={styles.statusRow}>
          <StatusDot status={status.status} accessibilityLabel={status.label} />
          <Tag label={status.label} variant="outline" />
        </View>
      </Card>

      <Text style={styles.description}>
        请在运行时填写测试凭据。只有主动点击预初始化后才会保存配置快照，
        明示同意隐私政策前不会调用 native/vendor 初始化。
      </Text>

      <CredentialForm
        draft={setup.draft}
        errors={setup.errors}
        disabled={!editing || setup.phase === 'preInitializing'}
        onChange={actions.updateCredential}
      />

      {editing ? (
        <Button
          label="预初始化"
          block
          loading={setup.phase === 'preInitializing'}
          disabled={setup.phase === 'preInitializing'}
          onPress={() => {
            actions.preInitialize();
          }}
        />
      ) : null}

      {awaitingConsent ? (
        <Card>
          <View style={styles.actions}>
            <Text style={styles.description}>请阅读并明确同意隐私政策</Text>
            <View style={styles.consentRow}>
              <Text style={styles.consentCopy}>同意隐私政策</Text>
              <Switch
                accessibilityLabel="同意隐私政策"
                value={setup.consent}
                onChange={actions.setConsent}
                disabled={setup.phase === 'initializing'}
              />
            </View>
            <Button
              label="同意并初始化"
              block
              loading={setup.phase === 'initializing'}
              disabled={!setup.consent || setup.phase === 'initializing'}
              onPress={() => {
                actions.initialize();
              }}
            />
          </View>
        </Card>
      ) : null}

      {setup.phase === 'initFailedLocked' ? (
        <View style={styles.actions}>
          <OperationFeedback feedback={setup.feedback} />
          <Text style={styles.description}>
            配置已经锁定；可以使用相同配置重试。若需修改配置，请重启 App。
          </Text>
          <Button
            label="重试初始化"
            block
            onPress={() => {
              actions.retryInitialize();
            }}
          />
        </View>
      ) : (
        <OperationFeedback feedback={setup.feedback} />
      )}
    </ShowcaseScaffold>
  );
}
