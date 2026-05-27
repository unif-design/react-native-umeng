import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  BottomSheet,
  Cell,
  Button,
  useTheme,
} from '@unif/react-native-design';
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

export const ShareSheetHost: React.FC = () => {
  const theme = useTheme();
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

  if (!state.open) return null;

  const title = state.options.title ?? '分享至';
  const cancelText = state.options.cancelText ?? '取消';
  const subtitles = state.options.subtitles ?? {};
  const hideUninstalled = state.options.hideUninstalled ?? false;

  const visiblePlatforms = state.platforms.filter(
    (p) => !hideUninstalled || p.installed
  );

  return (
    <BottomSheet
      snapPoints={['30%']}
      grabber
      backdrop="scrim"
      onClose={handleCancel}
    >
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>
          {title}
        </Text>
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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  head: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  cancel: { marginTop: 14 },
});
