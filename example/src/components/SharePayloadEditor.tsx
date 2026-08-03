import {
  Form,
  FormGroup,
  FormRow,
  Input,
  StatusDot,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import type { ShareContentDraft } from '../content/shareContent';
import type { DirectShareType } from '../state/operations';

type SharePayloadEditorProps = {
  readonly type: DirectShareType;
  readonly draft: ShareContentDraft;
  readonly onChange: (field: keyof ShareContentDraft, value: string) => void;
  readonly onPreviewReadyChange?: (ready: boolean) => void;
};

type PreviewState = 'idle' | 'loading' | 'ready' | 'error';

const makeStyles = (colors: ColorTokens) => ({
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

function previewConfig(
  type: DirectShareType,
  draft: ShareContentDraft
): { readonly url: string; readonly label: string } | null {
  switch (type) {
    case 'text':
      return null;
    case 'image':
      return { url: draft.image, label: '分享图片预览' };
    case 'link':
      return { url: draft.thumb, label: '分享缩略图预览' };
  }
}

export function SharePayloadEditor({
  type,
  draft,
  onChange,
  onPreviewReadyChange,
}: SharePayloadEditorProps) {
  const styles = useThemedStyles(makeStyles);
  const config = previewConfig(type, draft);
  const hasPreview = config != null;
  const [previewState, setPreviewState] = useState<PreviewState>(
    config == null ? 'idle' : 'loading'
  );
  const previewUrl = config?.url ?? '';

  useEffect(() => {
    if (!hasPreview) {
      setPreviewState('idle');
      onPreviewReadyChange?.(true);
      return;
    }
    setPreviewState('loading');
    onPreviewReadyChange?.(false);
  }, [hasPreview, onPreviewReadyChange, previewUrl, type]);

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

      {config == null ? null : (
        <View style={styles.previewCard}>
          <Image
            key={`${type}-${previewUrl}`}
            accessibilityLabel={config.label}
            source={{ uri: previewUrl }}
            style={styles.preview}
            resizeMode="cover"
            onLoad={() => {
              setPreviewState('ready');
              onPreviewReadyChange?.(true);
            }}
            onError={() => {
              setPreviewState('error');
              onPreviewReadyChange?.(false);
            }}
          />
          <View style={styles.previewStatus}>
            <StatusDot
              status={
                previewState === 'ready'
                  ? 'done'
                  : previewState === 'error'
                    ? 'error'
                    : 'active'
              }
              accessibilityLabel={
                previewState === 'ready'
                  ? '预览加载成功'
                  : previewState === 'error'
                    ? '预览加载失败'
                    : '预览加载中'
              }
            />
            <Text style={styles.previewCopy}>
              {previewState === 'ready' ? '素材预览可用' : '正在检查远程素材'}
            </Text>
          </View>
          {previewState === 'error' ? (
            <Text style={styles.error}>图片预览失败，请修改 URL 后重试</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
