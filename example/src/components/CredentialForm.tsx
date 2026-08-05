import {
  Form,
  FormGroup,
  FormRow,
  Input,
  PasswordInput,
  Switch,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { View } from 'react-native';

import type { CredentialDraft, CredentialErrors } from '../state/setupState';

type CredentialFormProps = {
  readonly draft: CredentialDraft;
  readonly errors: CredentialErrors;
  readonly disabled: boolean;
  readonly onChange: (
    field: keyof CredentialDraft,
    value: string | boolean
  ) => void;
};

const makeStyles = (_colors: ColorTokens) => ({
  nestedFields: {
    gap: 12,
  },
});

export function CredentialForm({
  draft,
  errors,
  disabled,
  onChange,
}: CredentialFormProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Form>
      <FormGroup label="友盟配置">
        <FormRow label="Umeng AppKey" required error={errors.appkey}>
          <Input
            accessibilityLabel="Umeng AppKey"
            value={draft.appkey}
            onChangeText={(value) => onChange('appkey', value)}
            autoCapitalize="none"
            autoCorrect={false}
            disabled={disabled}
          />
        </FormRow>
        <FormRow label="Channel" error={errors.channel}>
          <Input
            accessibilityLabel="Channel"
            value={draft.channel}
            onChangeText={(value) => onChange('channel', value)}
            autoCapitalize="none"
            disabled={disabled}
          />
        </FormRow>
      </FormGroup>

      <FormGroup label="微信会话">
        <FormRow label="启用微信">
          <Switch
            accessibilityLabel="启用微信"
            value={draft.wechatEnabled}
            onChange={(value) => onChange('wechatEnabled', value)}
            disabled={disabled}
          />
        </FormRow>
        {draft.wechatEnabled ? (
          <View style={styles.nestedFields}>
            <FormRow label="微信 App ID" required error={errors.wechatAppId}>
              <Input
                accessibilityLabel="微信 App ID"
                value={draft.wechatAppId}
                onChangeText={(value) => onChange('wechatAppId', value)}
                autoCapitalize="none"
                disabled={disabled}
              />
            </FormRow>
            <FormRow
              label="微信 App Secret"
              required
              error={errors.wechatAppSecret}
            >
              <PasswordInput
                value={draft.wechatAppSecret}
                onChangeText={(value) => onChange('wechatAppSecret', value)}
                disabled={disabled}
                accessibilityLabel="微信 App Secret"
                autoCapitalize="none"
              />
            </FormRow>
            <FormRow label="Universal Link" error={errors.wechatUniversalLink}>
              <Input
                accessibilityLabel="微信 Universal Link"
                value={draft.wechatUniversalLink}
                onChangeText={(value) => onChange('wechatUniversalLink', value)}
                autoCapitalize="none"
                keyboardType="url"
                disabled={disabled}
              />
            </FormRow>
          </View>
        ) : null}
      </FormGroup>

      <FormGroup label="钉钉">
        <FormRow label="启用钉钉">
          <Switch
            accessibilityLabel="启用钉钉"
            value={draft.dingtalkEnabled}
            onChange={(value) => onChange('dingtalkEnabled', value)}
            disabled={disabled}
          />
        </FormRow>
        {draft.dingtalkEnabled ? (
          <FormRow label="钉钉 App ID" required error={errors.dingtalkAppId}>
            <Input
              accessibilityLabel="钉钉 App ID"
              value={draft.dingtalkAppId}
              onChangeText={(value) => onChange('dingtalkAppId', value)}
              autoCapitalize="none"
              disabled={disabled}
            />
          </FormRow>
        ) : null}
      </FormGroup>
    </Form>
  );
}
