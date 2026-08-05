import {
  Form,
  FormGroup,
  FormRow,
  Input,
  StatusDot,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { Image, Text, View } from 'react-native';

import type { ShareContentDraft } from '../content/shareContent';
import type { DirectShareType } from '../state/operations';
import {
  requiredPreviews,
  type PreviewResolution,
  type PreviewResolutionByKey,
} from '../state/previewState';

type SharePayloadEditorProps = {
  readonly type: DirectShareType;
  readonly draft: ShareContentDraft;
  readonly onChange: (field: keyof ShareContentDraft, value: string) => void;
  readonly previewResolutions: PreviewResolutionByKey;
  readonly onPreviewResolutionChange: (
    key: string,
    resolution: PreviewResolution
  ) => void;
};

const makeStyles = (colors: ColorTokens) => ({
  previewList: {
    gap: 8,
  },
  previewCard: {
    gap: 8,
  },
  preview: {
    width: '100%' as const,
    height: 168,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
  },
  previewStatus: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  previewCopy: {
    flex: 1,
    color: colors.foregroundMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
  },
});

export function SharePayloadEditor({
  type,
  draft,
  onChange,
  previewResolutions,
  onPreviewResolutionChange,
}: SharePayloadEditorProps) {
  const styles = useThemedStyles(makeStyles);
  const previews = requiredPreviews(type, draft);

  const update = (field: keyof ShareContentDraft) => (value: string) => {
    onChange(field, value);
  };

  return (
    <View>
      <Form>
        <FormGroup label="分享内容">
          {type === 'text' ? (
            <FormRow label="分享文本" required>
              <Input
                accessibilityLabel="分享文本"
                value={draft.text}
                onChangeText={update('text')}
              />
            </FormRow>
          ) : null}

          {type === 'image' ? (
            <>
              <FormRow label="图片 URL" required>
                <Input
                  accessibilityLabel="图片 URL"
                  value={draft.image}
                  onChangeText={update('image')}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </FormRow>
              <FormRow label="缩略图 URL">
                <Input
                  accessibilityLabel="图片缩略图 URL"
                  value={draft.thumb}
                  onChangeText={update('thumb')}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </FormRow>
            </>
          ) : null}

          {type === 'link' ? (
            <>
              <FormRow label="链接标题" required>
                <Input
                  accessibilityLabel="链接标题"
                  value={draft.title}
                  onChangeText={update('title')}
                />
              </FormRow>
              <FormRow label="链接 URL" required>
                <Input
                  accessibilityLabel="链接 URL"
                  value={draft.url}
                  onChangeText={update('url')}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </FormRow>
              <FormRow label="链接描述">
                <Input
                  accessibilityLabel="链接描述"
                  value={draft.description}
                  onChangeText={update('description')}
                />
              </FormRow>
              <FormRow label="缩略图 URL">
                <Input
                  accessibilityLabel="链接缩略图 URL"
                  value={draft.thumb}
                  onChangeText={update('thumb')}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </FormRow>
            </>
          ) : null}
        </FormGroup>
      </Form>

      {previews.length === 0 ? null : (
        <View style={styles.previewList}>
          {previews.map((preview) => {
            const resolution = previewResolutions[preview.key];
            const status =
              resolution === 'ready'
                ? 'done'
                : resolution === 'error'
                  ? 'error'
                  : 'active';
            const statusLabel =
              resolution === 'ready'
                ? '预览加载成功'
                : resolution === 'error'
                  ? '预览加载失败'
                  : '预览加载中';
            const copy =
              resolution === 'ready'
                ? '素材预览可用'
                : resolution === 'error'
                  ? '图片预览失败，请修改 URL 后重试'
                  : '正在检查远程素材';
            return (
              <View key={preview.key} style={styles.previewCard}>
                <Image
                  accessibilityLabel={preview.accessibilityLabel}
                  source={{ uri: preview.url }}
                  style={styles.preview}
                  resizeMode="cover"
                  onLoad={() => {
                    onPreviewResolutionChange(preview.key, 'ready');
                  }}
                  onError={() => {
                    onPreviewResolutionChange(preview.key, 'error');
                  }}
                />
                <View style={styles.previewStatus}>
                  <StatusDot status={status} accessibilityLabel={statusLabel} />
                  <Text
                    style={[
                      styles.previewCopy,
                      resolution === 'error' ? styles.error : null,
                    ]}
                  >
                    {copy}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
