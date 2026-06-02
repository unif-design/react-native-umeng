import React from 'react';

// Stroke SVG icon set — viewBox 24, strokeWidth 1.75, round caps.
// All inherit currentColor.

type IconProps = { s?: number };

const _svg = (
  s: number,
  children: React.ReactNode,
): React.JSX.Element => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

// mark icon — Share (umeng site logo)
export function IconShare({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 3v13" />
    <path d="M8 7l4-4 4 4" />
  </>);
}

// feature: 友盟移动统计
export function IconChart({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <rect x={7} y={12} width={3} height={5} />
    <rect x={12} y={8} width={3} height={9} />
    <rect x={17} y={5} width={3} height={12} />
  </>);
}

// feature: 合规初始化
export function IconShield({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </>);
}

// ShareScreen: close button
export function IconClose({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>);
}

// ShareScreen: chevron right (cell arrow)
export function IconChevronRight({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <path d="M9 6l6 6-6 6" />);
}

// CTA: arrow right
export function IconArrowRight({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <>
    <path d="M5 12h14" />
    <path d="M13 5l7 7-7 7" />
  </>);
}

// install copy button
export function IconCopy({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <>
    <rect x={8} y={8} width={13} height={13} rx={2} />
    <path d="M4 16V5a2 2 0 0 1 2-2h11" />
  </>);
}

// install copy button: copied state
export function IconCheck({ s = 24 }: IconProps): React.JSX.Element {
  return _svg(s, <path d="M20 6L9 17l-5-5" />);
}

// ── Brand glyphs (social share targets) ──

// WeChat brand glyph — green #07C160
export function WeChatGlyph({ size = 32 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="0" y="0" width="24" height="24" rx="6" fill="#07C160" />
      <path
        d="M9.69 5.19C6.49 5.19 3.9 7.38 3.9 10.08c0 1.47.78 2.8 2 3.7a.39.39 0 0 1 .14.44l-.26.99c-.02.05.04.1.1.07l1.27-.74c.14-.08.32-.11.48-.07.59.15 1.22.24 1.89.27.18 0 .36-.02.54-.04-.57-1.72.1-3.31 1.29-4.3 1.13-.94 2.59-1.32 3.9-1.22-.38-2.4-2.79-4.23-5.73-4.23zM7.79 7.73a.78.78 0 1 1 0 1.57.78.78 0 0 1 0-1.57zm3.87 0a.78.78 0 1 1 0 1.57.78.78 0 0 1 0-1.57zm4.45 1.91c-2.97 0-5.34 1.97-5.34 4.4 0 2.43 2.37 4.4 5.34 4.4.61 0 1.2-.09 1.74-.25a.48.48 0 0 1 .4.05l1.05.62c.04.02.07.03.1.03.09 0 .16-.08.16-.17 0-.04-.01-.08-.02-.12l-.22-.82a.39.39 0 0 1-.02-.1c0-.11.07-.21.14-.27.95-.65 1.6-1.75 1.6-3.04 0-2.14-1.95-3.9-4.43-3.9-.09 0-.18.01-.27.02v-.02c-.09-.01-.18-.02-.27-.02zm-1.71 2.32c.36 0 .64.29.64.65 0 .36-.28.65-.64.65-.36 0-.64-.29-.64-.65 0-.36.28-.65.64-.65zm3.23 0c.36 0 .64.29.64.65 0 .36-.28.65-.64.65-.36 0-.64-.29-.64-.65 0-.36.28-.65.64-.65z"
        fill="#fff"
      />
    </svg>
  );
}

// DingTalk brand glyph — blue #1677FF
export function DingTalkGlyph({ size = 32 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="0" y="0" width="24" height="24" rx="6" fill="#1677FF" />
      <path
        d="M17.6 9.1c.5 0 .87.08 1.12.23.27.16.37.5.27.83-.13.36-.7 1.18-1.4 2.17l-.04.04c.4-.01.75.03 1 .12.5.2.7.52.58.94-.18.58-.87 1.62-1.9 2.78v.004c-1.16 1.32-2.99 2.78-4.9 3.5-1.22.47-2.45.7-3.52.7-2.78 0-4.85-1.42-4.85-3.83 0-2.88 3.28-6.1 7.6-7.4 1.78-.52 3.37-.66 4.64-.66.88 0 1.55.07 1.98.22zm-2.62 5.52c.04-.1.18-.37.25-.52l.005-.005c.04-.06.05-.11.05-.15 0-.11-.11-.17-.3-.17-.1 0-.22.014-.38.04-.93.17-1.78.38-2.55.62-.78.25-1.45.5-2 .75-.84.37-1.45.85-1.77 1.42-.4.68-.39 1.4.05 2.12.3.5.75.9 1.27 1.12.12.04.21.06.31.06.15 0 .24-.05.31-.18.1-.18.34-.61.53-.95.04-.07.07-.14.105-.21-.34-.07-.53-.2-.53-.52 0-.45.4-.87 1.18-1.18.81-.32 1.85-.52 2.73-.52.53 0 .94.07 1.26.2.1.045.18.04.24.005.05-.04.08-.1.08-.18z"
        fill="#fff"
      />
    </svg>
  );
}
