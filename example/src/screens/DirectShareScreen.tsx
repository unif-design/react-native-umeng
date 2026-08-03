import {
  Button,
  Card,
  Segmented,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { Platform } from '@unif/react-native-umeng';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { OperationFeedback } from '../components/OperationFeedback';
import { SharePayloadEditor } from '../components/SharePayloadEditor';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import {
  DEFAULT_SHARE_CONTENT,
  type ShareContentDraft,
} from '../content/shareContent';
import type { DirectShareType } from '../state/operations';
import { useShowcase } from '../state/useShowcase';

const TYPE_ITEMS = [
  { id: 'text', label: '编辑文本' },
  { id: 'image', label: '编辑图片' },
  { id: 'link', label: '编辑链接' },
];

const SHARE_ACTIONS: readonly {
  readonly platform: Platform;
  readonly platformName: string;
  readonly type: DirectShareType;
  readonly typeName: string;
}[] = [
  {
    platform: Platform.WECHAT_SESSION,
    platformName: '微信会话',
    type: 'text',
    typeName: '文本',
  },
  {
    platform: Platform.WECHAT_SESSION,
    platformName: '微信会话',
    type: 'image',
    typeName: '图片',
  },
  {
    platform: Platform.WECHAT_SESSION,
    platformName: '微信会话',
    type: 'link',
    typeName: '链接',
  },
  {
    platform: Platform.DINGTALK,
    platformName: '钉钉',
    type: 'text',
    typeName: '文本',
  },
  {
    platform: Platform.DINGTALK,
    platformName: '钉钉',
    type: 'image',
    typeName: '图片',
  },
  {
    platform: Platform.DINGTALK,
    platformName: '钉钉',
    type: 'link',
    typeName: '链接',
  },
];

const makeStyles = (colors: ColorTokens) => ({
  sectionTitle: {
    color: colors.foregroundMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
});

export function DirectShareScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();
  const [editorType, setEditorType] = useState<DirectShareType>('image');
  const [content, setContent] = useState<ShareContentDraft>({
    ...DEFAULT_SHARE_CONTENT,
  });
  const [mediaReady, setMediaReady] = useState(false);
  const latestSuccess = useMemo(
    () =>
      state.logs.find(
        (log) => log.scope === 'share' && log.message.startsWith('success@')
      )?.message ?? null,
    [state.logs]
  );

  return (
    <ShowcaseScaffold title="直接分享" onBack={actions.back}>
      <Segmented
        value={editorType}
        items={TYPE_ITEMS}
        onChange={(nextType) => {
          const selectedType = nextType as DirectShareType;
          setEditorType(selectedType);
          if (selectedType !== 'text') {
            setMediaReady(false);
          }
        }}
      />
      <SharePayloadEditor
        type={editorType}
        draft={content}
        onChange={(field, value) => {
          setContent((current) => ({ ...current, [field]: value }));
        }}
        onPreviewReadyChange={editorType === 'text' ? undefined : setMediaReady}
      />

      <Card variant="plain">
        <View style={styles.actions}>
          <Text style={styles.sectionTitle}>
            两个平台分别验证文本、图片与链接直拉
          </Text>
          {SHARE_ACTIONS.map((action) => {
            const installed = state.platforms.items.find(
              (item) => item.platform === action.platform
            )?.installed;
            const needsMedia = action.type !== 'text';
            return (
              <Button
                key={`${action.platform}-${action.type}`}
                label={`${action.platformName} · ${action.typeName}`}
                variant={action.type === 'text' ? 'secondary' : 'outline'}
                block
                disabled={installed === false || (needsMedia && !mediaReady)}
                onPress={() => {
                  actions.shareDirect(action.type, action.platform, content);
                }}
              />
            );
          })}
        </View>
      </Card>
      <OperationFeedback
        feedback={state.feedback}
        successMessage={state.feedback == null ? latestSuccess : null}
      />
    </ShowcaseScaffold>
  );
}
