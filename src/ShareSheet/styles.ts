import { StyleSheet } from 'react-native';
import {
  brandPalette,
  fw,
  tracking,
  type as typography,
} from '@unif/react-native-design';
import type { ColorTokens } from '@unif/react-native-design';

export const makeSheetStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1 },
    floatingRoot: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: 'flex-end',
      zIndex: 1100,
      elevation: 1100,
    },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
    glass: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
      // 固定底部留白覆盖 home indicator(umeng 不引 safe-area-context 依赖)
      paddingBottom: 34,
      overflow: 'hidden',
    },
    platform: { backgroundColor: 'transparent' },
    head: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 4 },
    title: {
      fontSize: typography.body,
      fontWeight: fw.semi,
      letterSpacing: tracking.subtle,
      color: c.foreground,
    },
    cancel: { marginTop: 14 },
  });

export const platformLeadingStyles = StyleSheet.create({
  wechat: { backgroundColor: brandPalette.wechat },
  container: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
