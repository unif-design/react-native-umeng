import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Cell, Button, useThemedStyles } from '@unif/react-native-design';
import type { ColorTokens } from '@unif/react-native-design';
import {
  PLATFORM_DEFAULT_SUBTITLES,
  PLATFORM_DISPLAY_NAMES,
  SUPPORTED_PLATFORMS,
  UmengError,
  type ShareSheetOptions,
  type ShareSheetPayload,
  type ShareResult,
  type PlatformInfo,
} from '../types';
import * as Share from '../share';
import { shareSheetController } from './ShareSheetController';
import { PlatformLeading } from './PlatformLeading';

interface SheetState {
  open: boolean;
  payload: ShareSheetPayload | null;
  options: ShareSheetOptions;
  platforms: PlatformInfo[];
}

const INITIAL_STATE: SheetState = {
  open: false,
  payload: null,
  options: {},
  platforms: [],
};

/**
 * 分享面板宿主 —— state-driven(shareSheetController 订阅 show/dismiss)。
 * 原生 RN `Modal`(transparent + slide 底部弹出)实现,替代原 design 的
 * @gorhom BottomSheet,去第三方依赖。backdrop 点击取消、内层 sheet 拦截冒泡。
 */
export const ShareSheetHost: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<SheetState>(INITIAL_STATE);

  useEffect(() => {
    const unsub = shareSheetController.subscribe((e) => {
      if (e.kind === 'show') {
        void (async () => {
          const platforms = await Share.listPlatforms().catch(() =>
            SUPPORTED_PLATFORMS.map((p) => ({
              platform: p,
              installed: false,
              displayName: PLATFORM_DISPLAY_NAMES[p],
            }))
          );
          setState({
            open: true,
            payload: e.payload,
            options: e.options,
            platforms,
          });
        })();
      } else if (e.kind === 'dismiss') {
        setState((prev) => ({ ...prev, open: false }));
      }
    });
    return unsub;
  }, []);

  const handlePlatformPress = useCallback(
    (info: PlatformInfo) => {
      if (!info.installed) {
        shareSheetController.settleError(
          new UmengError(
            'E_PLATFORM_NOT_INSTALLED',
            `${info.displayName} 未安装`
          )
        );
        return;
      }
      const { payload } = state;
      if (!payload) return;
      void (async () => {
        try {
          let result: ShareResult;
          if (payload.type === 'text') {
            result = await Share.shareText({
              platform: info.platform,
              text: payload.text,
            });
          } else if (payload.type === 'image') {
            result = await Share.shareImage({
              platform: info.platform,
              image: payload.image,
              thumb: payload.thumb,
            });
          } else {
            result = await Share.shareLink({
              platform: info.platform,
              title: payload.title,
              url: payload.url,
              description: payload.description,
              thumb: payload.thumb,
            });
          }
          shareSheetController.settle(result);
        } catch (err) {
          const ue =
            err instanceof UmengError
              ? err
              : new UmengError('E_UNKNOWN', String(err), err);
          shareSheetController.settleError(ue);
        }
      })();
    },
    [state]
  );

  const handleCancel = useCallback(() => {
    shareSheetController.dismiss('cancel');
  }, []);

  const title = state.options.title ?? '分享至';
  const cancelText = state.options.cancelText ?? '取消';
  const subtitles = state.options.subtitles ?? {};
  const hideUninstalled = state.options.hideUninstalled ?? false;

  const visiblePlatforms = state.platforms.filter(
    (p) => !hideUninstalled || p.installed
  );

  return (
    <Modal
      visible={state.open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      {/* backdrop 点击取消;内层 sheet onPress 空占位拦截冒泡 */}
      <Pressable
        style={styles.backdrop}
        onPress={handleCancel}
        accessibilityRole="button"
        accessibilityLabel="关闭"
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View>
            {visiblePlatforms.map((info) => (
              <Cell
                key={info.platform}
                testID={`umeng-share-cell-${info.platform}`}
                title={info.displayName}
                desc={
                  subtitles[info.platform] ??
                  PLATFORM_DEFAULT_SUBTITLES[info.platform]
                }
                leading={<PlatformLeading platform={info.platform} />}
                arrow
                disabled={!info.installed}
                onPress={() => handlePlatformPress(info)}
              />
            ))}
          </View>
          <Button
            testID="umeng-share-cancel"
            variant="secondary"
            size="lg"
            block
            label={cancelText}
            style={styles.cancel}
            onPress={handleCancel}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
      // 固定底部留白覆盖 home indicator(umeng 不引 safe-area-context 依赖)
      paddingBottom: 34,
      backgroundColor: c.surface,
    },
    head: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
    title: {
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.1,
      color: c.foreground,
    },
    cancel: { marginTop: 14 },
  });
