import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ICONS, type IconDef, type IconName } from './iconsCatalog';

/**
 * Unif Portal 图标目录 —— 顶部搜索(⌘K)+ 按语义类别分段 + 网格 + 点击复制。
 * 跟随 Lucide / Heroicons / Phosphor 等主流图标库的展示约定:不挂侧栏,类别用 sub-head 在内容流里分段。
 *
 * 数据 source:`@/assets/icons`(由 `scripts/build-icons.js` 从 SVG 生成);
 * 本组件只维护"哪些图标属于哪个语义类别"。
 */

type Category = {
  name: string;
  desc: string;
  items: ReadonlyArray<IconName>;
};

/** 15 个语义类别。 */
const CATEGORIES: ReadonlyArray<Category> = [
  { name: '方向', desc: 'Direction', items: [
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
  ] },
  { name: '菜单', desc: 'Menu', items: ['menu', 'more-h', 'more-v'] },
  { name: '状态', desc: 'Status', items: ['check', 'close', 'success', 'error', 'warning', 'alert', 'info'] },
  { name: '编辑操作', desc: 'Edit & CRUD', items: [
    'edit', 'edit-pencil', 'copy', 'trash', 'plus', 'circle-plus', 'circle-minus', 'logout',
  ] },
  { name: '传输操作', desc: 'Transfer', items: [
    'send', 'share', 'upload', 'download', 'refresh', 'retry', 'stop', 'scan',
  ] },
  { name: '对象', desc: 'Objects', items: [
    'bell', 'calendar', 'camera', 'card', 'clipboard', 'file', 'flag', 'image',
    'lock', 'mail', 'phone', 'tag', 'location',
  ] },
  { name: '控件', desc: 'Controls', items: [
    'eye', 'eye-off', 'filter', 'grid', 'list', 'sort', 'search', 'settings',
    'keyboard', 'play', 'pause', 'sound',
  ] },
  { name: '输入', desc: 'Input', items: ['mic', 'mic-on', 'paperclip', 'attachment', 'qr'] },
  { name: 'AI 智能', desc: 'AI', items: ['bot', 'spark', 'thinking', 'lightbulb'] },
  { name: '业务', desc: 'Business', items: [
    'home', 'user', 'building', 'heart', 'star', 'order', 'package', 'route', 'visit',
  ] },
  { name: '店面', desc: 'Storefront', items: [
    'storefront', 'storefront-check', 'storefront-tag', 'storefront-ai', 'storefront-arrow',
  ] },
  { name: '仪表盘', desc: 'Dashboard', items: ['dashboard-star', 'dashboard-megaphone'] },
  { name: '文档·检索', desc: 'Documents & Search', items: [
    'clipboard-search', 'clipboard-user', 'pin-search', 'users-search',
    'calendar-route', 'shield-check', 'scanner',
  ] },
  { name: '容器·财务', desc: 'Containers & Finance', items: [
    'box-list', 'box-up', 'calculator', 'coin', 'bag-check', 'shelf-pay',
  ] },
  { name: '反馈·占位', desc: 'Feedback & Placeholder', items: ['chat-star', 'app-fallback'] },
];

const slug = (s: string): string => `cat-${s.replace(/[\s·.\/]+/g, '-')}`;

export default function IconCatalog(): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<IconName | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const q = query.trim().toLowerCase();
  const totalIcons = useMemo(
    () => CATEGORIES.reduce((sum, c) => sum + c.items.length, 0),
    [],
  );

  const filteredCategories = useMemo(() => {
    if (!q) return CATEGORIES.map(c => ({ ...c, visible: c.items }));
    return CATEGORIES.map(c => ({
      ...c,
      visible: c.items.filter(n => n.toLowerCase().includes(q)),
    }));
  }, [q]);
  const totalVisible = filteredCategories.reduce((s, c) => s + c.visible.length, 0);

  function handleCopy(name: IconName) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(name);
    }
    setCopied(name);
    window.setTimeout(() => setCopied(c => (c === name ? null : c)), 800);
  }

  // ⌘K / Ctrl+K 聚焦搜索;Esc 清空
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setQuery('');
        searchInputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ic-catalog">
      <header className="ic-topbar">
        <div className="ic-topbar__inner">
          <div className="ic-topbar__titles">
            <h2 className="ic-topbar__h1">图标库 · {totalIcons}</h2>
            <div className="ic-topbar__crumbs">点击 cell 复制语义名 · ⌘K 聚焦搜索</div>
          </div>
          <div className={`ic-search ${query ? 'ic-search--has-value' : ''}`}>
            <input
              ref={searchInputRef}
              className="ic-search__input"
              type="search"
              placeholder="搜索图标名称…(⌘K)"
              autoComplete="off"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="ic-search__clear"
                aria-label="清除搜索"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="ic-main">
        {filteredCategories.map(cat => {
          const id = slug(cat.name);
          if (q && cat.visible.length === 0) return null;
          return (
            <React.Fragment key={id}>
              <div className="ic-sub-head" id={id}>
                <h4 className="ic-sub-head__title">{cat.name}</h4>
                <span className="ic-sub-head__count">{cat.visible.length}</span>
                <span className="ic-sub-head__desc">{cat.desc}</span>
              </div>
              <div className="ic-grid">
                {cat.visible.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={`ic-cell ${copied === name ? 'ic-cell--copied' : ''}`}
                    title={`点击复制 "${name}"`}
                    onClick={() => handleCopy(name)}
                  >
                    <span className="ic-cell__svg">
                      <RenderIcon def={ICONS[name]} />
                    </span>
                    <span className="ic-cell__name">{name}</span>
                  </button>
                ))}
              </div>
            </React.Fragment>
          );
        })}

        {q && totalVisible === 0 ? (
          <div className="ic-empty">
            <div className="ic-empty__big">未找到匹配的图标</div>
            <div className="ic-empty__sub">试试其他关键词,或按 Esc 清空</div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function RenderIcon({ def }: { def: IconDef }): React.JSX.Element {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={def.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      {def.elements.map((el, i) => {
        const fill = el.fill === 'currentColor' ? 'currentColor' : el.fill ?? 'none';
        if (el.kind === 'path') return <path key={i} d={el.d} fill={fill} />;
        if (el.kind === 'circle')
          return <circle key={i} cx={el.cx} cy={el.cy} r={el.r} fill={fill} />;
        if (el.kind === 'rect')
          return (
            <rect
              key={i}
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              rx={el.rx}
              ry={el.ry}
              fill={fill}
            />
          );
        return null;
      })}
    </svg>
  );
}
