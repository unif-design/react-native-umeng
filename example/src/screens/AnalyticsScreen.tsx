import {
  Button,
  Form,
  FormGroup,
  FormRow,
  Input,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { OperationFeedback } from '../components/OperationFeedback';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import { useShowcase } from '../state/useShowcase';

const makeStyles = (colors: ColorTokens) => ({
  description: {
    color: colors.foregroundMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
  },
});

export function AnalyticsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();
  const [eventId, setEventId] = useState('showcase_event');
  const [userId, setUserId] = useState('showcase-user');
  const [provider, setProvider] = useState('demo');
  const latestSuccess = useMemo(
    () => state.logs.find((log) => log.scope === 'analytics')?.message ?? null,
    [state.logs]
  );

  return (
    <ShowcaseScaffold title="Analytics" onBack={actions.back}>
      <Text style={styles.description}>
        Analytics API 是同步 void；按钮回调直接调用公开
        action，并立即写入安全日志。
      </Text>
      <Form>
        <FormGroup label="事件">
          <FormRow label="事件 ID" required>
            <Input
              accessibilityLabel="事件 ID"
              value={eventId}
              onChangeText={setEventId}
              autoCapitalize="none"
            />
          </FormRow>
        </FormGroup>
        <FormGroup label="用户">
          <FormRow label="用户 ID" required>
            <Input
              accessibilityLabel="用户 ID"
              value={userId}
              onChangeText={setUserId}
              autoCapitalize="none"
            />
          </FormRow>
          <FormRow label="Provider">
            <Input
              accessibilityLabel="Provider"
              value={provider}
              onChangeText={setProvider}
              autoCapitalize="none"
            />
          </FormRow>
        </FormGroup>
      </Form>
      <View style={styles.actions}>
        <Button
          label="记录事件"
          block
          disabled={eventId.trim().length === 0}
          onPress={() => {
            actions.trackEvent(eventId, { source: 'showcase', count: 1 });
          }}
        />
        <Button
          label="登录用户"
          variant="secondary"
          block
          disabled={userId.trim().length === 0}
          onPress={() => {
            actions.signIn(
              userId,
              provider.trim().length > 0 ? provider : undefined
            );
          }}
        />
        <Button
          label="退出登录"
          variant="outline"
          block
          onPress={actions.signOut}
        />
      </View>
      <OperationFeedback
        feedback={state.feedback}
        successMessage={state.feedback == null ? latestSuccess : null}
      />
    </ShowcaseScaffold>
  );
}
