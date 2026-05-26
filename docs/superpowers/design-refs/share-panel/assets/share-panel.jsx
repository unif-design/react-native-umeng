// Share Panel — Unif PEC Portal
// Built on the design system's base components:
//   .cell / .list-flush / .leading / .btn / .tag / .card / .sw
// Variants: tiles · grid · list — all powered by the same DS primitives.

const { useState, useEffect } = React;

const SHARE_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "list",
  "dark": false,
  "sheetTitle": "分享至"
}/*EDITMODE-END*/;

// ─── Brand glyphs (white-on-color, inline SVG) ─────────────────────
const WeChatGlyph = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M12.5 5C7.25 5 3 8.4 3 12.6c0 2.3 1.3 4.4 3.4 5.8L5.5 21l3.1-1.6c.9.2 1.7.3 2.6.4-.1-.5-.2-1-.2-1.6 0-4 3.9-7.3 8.7-7.3.4 0 .8 0 1.2.1C20.1 7.6 16.6 5 12.5 5Zm-3.4 4.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm6.6 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" fill="#fff"/>
    <path d="M19.6 12.8c-4.4 0-7.9 2.9-7.9 6.4 0 2 1.1 3.8 2.9 5l-.7 2 2.6-1.3c.7.2 1.4.3 2.1.4l.4.5 2.4 1.9-.5-2.3c2.4-1.1 4-3.2 4-5.6 0-3.6-3-6.5-7.2-6.5Zm-2.7 3.8a.9.9 0 1 1 0 1.9.9.9 0 0 1 0-1.9Zm5.4 0a.9.9 0 1 1 0 1.9.9.9 0 0 1 0-1.9Z" fill="#fff"/>
  </svg>
);
const DingTalkGlyph = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4Zm5.7 11.4-3.2 4.4h2l-3.6 5.6c-.2.3-.6.2-.5-.2l1-3.7-1.6.5c-.3.1-.5-.2-.4-.4l3-5.1H17l2.2-3.6c.2-.4.6-.4.9-.2l1.8 1.2c.3.2.4.5.2.8Z" fill="#fff"/>
  </svg>
);
const QRGlyph = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="3.5" width="6" height="6" rx="0.5"/>
    <rect x="14.5" y="3.5" width="6" height="6" rx="0.5"/>
    <rect x="3.5" y="14.5" width="6" height="6" rx="0.5"/>
    <path d="M14 14h2.5v2.5M20.5 14v2.5M14 20.5h2.5M20.5 20.5v-2.5M18 18h.01"/>
  </svg>
);

// DS-stroked SVG via <img> — DS recipe colors them through CSS filters.
const Ic = ({ name, size = 16, className = '' }) => (
  <img src={`assets/icons/${name}.svg`} width={size} height={size}
       alt="" className={className}/>
);

// ─── Visit summary screen (the artifact being shared) ──────────────
function VisitSummary({ onShareClick }) {
  return (
    <div className="screen">
      <div className="navbar">
        <button className="navbtn"><Ic name="chevron-left" size={20} className="navic"/></button>
        <div className="nav-title">拜访总结</div>
        <div className="nav-actions">
          <button className="navbtn"><Ic name="more-h" size={20} className="navic"/></button>
          <button className="navbtn primary" onClick={onShareClick} aria-label="分享">
            <Ic name="share" size={18}/>
          </button>
        </div>
      </div>

      <div className="screen-body">
        <div className="summary-hero">
          <div className="hero-meta">
            <span className="tag neutral"><Ic name="calendar" size={11} className="metaic"/>2026 / 5 / 26</span>
            <span className="tag neutral"><Ic name="location" size={11} className="metaic"/>1.2 km</span>
          </div>
          <h1 className="hero-title">东方便利店 · 北苑店</h1>
          <div className="hero-sub">VIP 客户 · 王经理 · 第 3 次拜访</div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-eyebrow">AI 总结</div>
            <div className="card-badge">已思考 3s</div>
          </div>
          <p className="card-text">
            本次拜访客户对夏季冰品上柜接受度高,已确认补货 22 箱(冰红茶 12 / 阿萨姆 10)。
            建议下次拜访带样品演示新品「茶里王 · 桂花乌龙」,客户在上一次拜访中表达过兴趣。
          </p>
          <div className="metrics">
            <div className="m"><div className="m-v">22</div><div className="m-l">补货箱数</div></div>
            <div className="m"><div className="m-v">¥4,860</div><div className="m-l">订单金额</div></div>
            <div className="m"><div className="m-v">38min</div><div className="m-l">在店时长</div></div>
          </div>
        </div>

        <div className="card">
          <div className="card-eyebrow" style={{ marginBottom: 8 }}>下一步</div>
          <div className="todo">
            <div className="todo-dot"></div>
            <div>
              <div className="todo-t">提交补货单</div>
              <div className="todo-d">系统将自动同步至 ERP</div>
            </div>
          </div>
          <div className="todo">
            <div className="todo-dot empty"></div>
            <div>
              <div className="todo-t">下周四回访</div>
              <div className="todo-d">带「桂花乌龙」样品</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Share sheet ───────────────────────────────────────────────────
function ShareSheet({ open, onClose, variant, sheetTitle }) {
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState(null);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 220);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1500); };

  if (!open && !closing) return null;

  const targets = [
    { key: 'wechat',   label: '微信', sub: '发送给好友或群', color: '#07C160', Glyph: WeChatGlyph },
    { key: 'dingtalk', label: '钉钉', sub: '发送至工作群',   color: '#1677FF', Glyph: DingTalkGlyph },
  ];

  return (
    <div className={`sheet-root ${closing ? 'closing' : 'opening'}`}>
      <div className="scrim" onClick={handleClose}/>

      <div className="sheet" role="dialog" aria-label="分享面板">
        <div className="grabber"/>

        <div className="sheet-head">
          <div className="sheet-title">{sheetTitle}</div>
          <button className="sheet-close" onClick={handleClose} aria-label="关闭">
            <Ic name="close" size={14} className="sheetic"/>
          </button>
        </div>

        {/* ─── Variant: tiles ─── */}
        {variant === 'tiles' && (
          <div className="tile-row">
            {targets.map(t => (
              <button key={t.key} className="tile"
                onClick={() => fire(`已发起分享至 ${t.label}`)}>
                <div className="tile-icon" style={{ background: t.color }}>
                  <t.Glyph size={26}/>
                </div>
                <div>
                  <div className="tile-label">{t.label}</div>
                  <div className="tile-sub">{t.sub}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ─── Variant: grid ─── */}
        {variant === 'grid' && (
          <div className="grid-row">
            {targets.map(t => (
              <button key={t.key} className="grid-item"
                onClick={() => fire(`已发起分享至 ${t.label}`)}>
                <div className="grid-disc" style={{ background: t.color }}>
                  <t.Glyph size={26}/>
                </div>
                <div className="grid-label">{t.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* ─── Variant: list (Unif DS .list-flush cells) ─── */}
        {variant === 'list' && (
          <div className="card-wrap" style={{ marginTop: 10 }}>
            <div className="list-flush divided">
              {targets.map(t => (
                <button key={t.key} className="cell with-desc"
                  onClick={() => fire(`已发起分享至 ${t.label}`)}>
                  <div className="leading brand-leading" style={{ background: t.color }}>
                    <t.Glyph size={18}/>
                  </div>
                  <div className="body">
                    <div className="ttl">{t.label}</div>
                    <div className="desc">{t.sub}</div>
                  </div>
                  <Ic name="chevron-right" className="arr"/>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn secondary xl block cancel-btn" onClick={handleClose}>取消</button>

        {toast && (
          <div className="toast">
            <Ic name="check" size={14} className="toastic"/>{toast}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root app ───────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(SHARE_DEFAULTS);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 350);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.dark ? 'dark' : 'light');
  }, [t.dark]);

  return (
    <div className={`stage ${t.dark ? 'dark' : ''}`}>
      <IOSDevice dark={t.dark} width={402} height={874}>
        <div className="device-inner" data-screen-label="01 拜访总结">
          <VisitSummary onShareClick={() => setOpen(true)}/>
          <ShareSheet
            open={open}
            onClose={() => setOpen(false)}
            variant={t.variant}
            sheetTitle={t.sheetTitle}
          />
        </div>
      </IOSDevice>

      <TweaksPanel title="Tweaks">
        <TweakSection label="布局"/>
        <TweakRadio label="样式变体"
          value={t.variant}
          onChange={(v) => setTweak('variant', v)}
          options={[
            { value: 'list',  label: '列表' },
            { value: 'tiles', label: '大卡片' },
            { value: 'grid',  label: '网格' },
          ]}/>

        <TweakSection label="外观"/>
        <TweakToggle label="暗色模式"
          value={t.dark}
          onChange={(v) => setTweak('dark', v)}/>
        <TweakText label="标题"
          value={t.sheetTitle}
          onChange={(v) => setTweak('sheetTitle', v)}/>

        <TweakSection label="演示"/>
        <TweakButton label="打开分享面板" onClick={() => setOpen(true)}/>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
