import {
  Card,
  IconButton,
  Segmented,
  useThemedStyles,
  type ColorTokens,
  type IconName,
} from '@unif/react-native-design';
import { Platform } from '@unif/react-native-umeng';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { OperationFeedback } from '../components/OperationFeedback';
import { SharePayloadEditor } from '../components/SharePayloadEditor';
import { ShowcaseScaffold } from '../components/ShowcaseScaffold';
import {
  DEFAULT_SHARE_CONTENT,
  type ShareContentDraft,
} from '../content/shareContent';
import type { DirectShareType } from '../state/operations';
import {
  isPreviewReady,
  type PreviewResolution,
  type PreviewResolutionByKey,
} from '../state/previewState';
import { useShowcase } from '../state/useShowcase';

const TYPE_ITEMS = [
  { id: 'text', label: '编辑文本' },
  { id: 'image', label: '编辑图片' },
  { id: 'link', label: '编辑链接' },
];

const SHARE_TYPES: readonly {
  readonly type: DirectShareType;
  readonly typeName: string;
  readonly icon: IconName;
}[] = [
  { type: 'text', typeName: '文本', icon: 'file' },
  { type: 'image', typeName: '图片', icon: 'image' },
  { type: 'link', typeName: '链接', icon: 'share' },
];

const SHARE_PLATFORMS: readonly {
  readonly platform: Platform;
  readonly platformName: string;
}[] = [
  {
    platform: Platform.WECHAT_SESSION,
    platformName: '微信会话',
  },
  { platform: Platform.DINGTALK, platformName: '钉钉' },
];

const makeStyles = (colors: ColorTokens) => ({
  sectionTitle: {
    color: colors.foregroundMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  matrix: {
    gap: 8,
  },
  matrixHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  matrixRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 52,
  },
  platformCell: {
    width: 80,
  },
  platformHeader: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  columnCell: {
    flex: 1,
    alignItems: 'center' as const,
  },
  columnHeader: {
    color: colors.foregroundMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
});

export function DirectShareScreen() {
  const styles = useThemedStyles(makeStyles);
  const { state, actions } = useShowcase();
  const [editorType, setEditorType] = useState<DirectShareType>('image');
  const [content, setContent] = useState<ShareContentDraft>({
    ...DEFAULT_SHARE_CONTENT,
  });
  const [previewResolutions, setPreviewResolutions] =
    useState<PreviewResolutionByKey>({});
  const latestSuccess = useMemo(
    () =>
      state.logs.find(
        (log) => log.scope === 'share' && log.message.startsWith('success@')
      )?.message ?? null,
    [state.logs]
  );
  const updatePreviewResolution = useCallback(
    (key: string, resolution: PreviewResolution): void => {
      setPreviewResolutions((current) =>
        current[key] === resolution
          ? current
          : { ...current, [key]: resolution }
      );
    },
    []
  );

  return (
    <ShowcaseScaffold title="直接分享" onBack={actions.back}>
      <Segmented
        value={editorType}
        items={TYPE_ITEMS}
        onChange={(nextType) => {
          setEditorType(nextType as DirectShareType);
        }}
      />
      <SharePayloadEditor
        type={editorType}
        draft={content}
        onChange={(field, value) => {
          setContent((current) => ({ ...current, [field]: value }));
        }}
        previewResolutions={previewResolutions}
        onPreviewResolutionChange={updatePreviewResolution}
      />

      <Card variant="plain">
        <View style={styles.matrix}>
          <Text style={styles.sectionTitle}>
            两个平台分别验证文本、图片与链接直拉
          </Text>
          <View style={styles.matrixHeader}>
            <View style={styles.platformCell}>
              <Text style={styles.columnHeader} accessibilityRole="header">
                平台
              </Text>
            </View>
            {SHARE_TYPES.map((shareType) => (
              <View key={shareType.type} style={styles.columnCell}>
                <Text style={styles.columnHeader} accessibilityRole="header">
                  {shareType.typeName}
                </Text>
              </View>
            ))}
          </View>
          {SHARE_PLATFORMS.map((sharePlatform) => {
            const installed = state.platforms.items.find(
              (item) => item.platform === sharePlatform.platform
            );
            return (
              <View key={sharePlatform.platform} style={styles.matrixRow}>
                <View style={styles.platformCell}>
                  <Text
                    style={styles.platformHeader}
                    accessibilityRole="header"
                  >
                    {sharePlatform.platformName}
                  </Text>
                </View>
                {SHARE_TYPES.map((shareType) => {
                  const knownFreshMissing =
                    installed?.freshness === 'fresh' && !installed.installed;
                  return (
                    <View key={shareType.type} style={styles.columnCell}>
                      <IconButton
                        icon={shareType.icon}
                        accessibilityLabel={`${sharePlatform.platformName} · ${shareType.typeName}`}
                        variant="outline"
                        disabled={
                          knownFreshMissing ||
                          !isPreviewReady(
                            shareType.type,
                            content,
                            previewResolutions
                          )
                        }
                        onPress={() => {
                          actions.shareDirect(
                            shareType.type,
                            sharePlatform.platform,
                            content
                          );
                        }}
                      />
                    </View>
                  );
                })}
              </View>
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
