import {
  Button,
  Form,
  FormGroup,
  FormRow,
  Input,
  Segmented,
  Switch,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  DEFAULT_SHARE_CONTENT,
  type ShareContentDraft,
} from '../content/shareContent';
import { OperationFeedback } from '../components/OperationFeedback';
import { SharePayloadEditor } from '../components/SharePayloadEditor';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import type { DirectShareType, SheetDraft } from '../state/operations';
import { useShowcase } from '../state/useShowcase';

const TYPE_ITEMS = [
  { id: 'text', label: '文本' },
  { id: 'image', label: '图片' },
  { id: 'link', label: '链接' },
];

const DEFAULT_OPTIONS: SheetDraft['options'] = {
  title: '分享到',
  cancelText: '取消',
  wechatSubtitle: '微信会话',
  dingtalkSubtitle: '钉钉',
  hideUninstalled: false,
};

const makeStyles = (_colors: ColorTokens) => ({
  section: {
    gap: 16,
  },
});

export function SheetScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();
  const [type, setType] = useState<DirectShareType>('text');
  const [content, setContent] = useState<ShareContentDraft>({
    ...DEFAULT_SHARE_CONTENT,
  });
  const [options, setOptions] =
    useState<SheetDraft['options']>(DEFAULT_OPTIONS);
  const [previewReady, setPreviewReady] = useState(true);
  const latestSuccess = useMemo(
    () =>
      state.logs.find(
        (log) => log.scope === 'share' && log.message.startsWith('success@')
      )?.message ?? null,
    [state.logs]
  );

  const updateContent = (
    field: keyof ShareContentDraft,
    value: string
  ): void => {
    setContent((current) => ({ ...current, [field]: value }));
  };

  const updateOption = (
    field: keyof SheetDraft['options'],
    value: string | boolean
  ): void => {
    setOptions((current) => ({ ...current, [field]: value }));
  };

  return (
    <ShowcaseScaffold title="分享面板" onBack={actions.back}>
      <Segmented
        value={type}
        items={TYPE_ITEMS}
        onChange={(nextType) => {
          const selectedType = nextType as DirectShareType;
          setType(selectedType);
          setPreviewReady(selectedType === 'text');
        }}
      />
      <View style={styles.section}>
        <SharePayloadEditor
          type={type}
          draft={content}
          onChange={updateContent}
          onPreviewReadyChange={setPreviewReady}
        />
      </View>

      <Form>
        <FormGroup label="分享面板选项">
          <FormRow label="面板标题">
            <Input
              accessibilityLabel="面板标题"
              value={options.title}
              onChangeText={(value) => updateOption('title', value)}
            />
          </FormRow>
          <FormRow label="取消按钮文案">
            <Input
              accessibilityLabel="取消按钮文案"
              value={options.cancelText}
              onChangeText={(value) => updateOption('cancelText', value)}
            />
          </FormRow>
          <FormRow label="微信副标题">
            <Input
              accessibilityLabel="微信副标题"
              value={options.wechatSubtitle}
              onChangeText={(value) => updateOption('wechatSubtitle', value)}
            />
          </FormRow>
          <FormRow label="钉钉副标题">
            <Input
              accessibilityLabel="钉钉副标题"
              value={options.dingtalkSubtitle}
              onChangeText={(value) => updateOption('dingtalkSubtitle', value)}
            />
          </FormRow>
          <FormRow label="隐藏未安装平台">
            <Switch
              accessibilityLabel="隐藏未安装平台"
              value={options.hideUninstalled}
              onChange={(value) => updateOption('hideUninstalled', value)}
            />
          </FormRow>
        </FormGroup>
      </Form>

      <Button
        label="打开分享面板"
        leftIcon="share"
        block
        disabled={type !== 'text' && !previewReady}
        onPress={() => {
          actions.openShareSheet({
            ...content,
            type,
            options,
          });
        }}
      />
      <OperationFeedback
        feedback={state.feedback}
        successMessage={state.feedback == null ? latestSuccess : null}
      />
    </ShowcaseScaffold>
  );
}
