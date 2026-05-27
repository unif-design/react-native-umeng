import React, { useState } from 'react';

type Entry = { name: string; hex: string; desc?: string };

export function Swatches({ items }: { items: Entry[] }): React.JSX.Element {
  return (
    <div className="unif-swatches">
      {items.map((item) => (
        <Swatch key={item.name} {...item} />
      ))}
    </div>
  );
}

function Swatch({ name, hex, desc }: Entry): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hex);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  }

  const chipStyle: React.CSSProperties = {
    background: hex,
    border: hex.toUpperCase() === '#FFFFFF' ? '1px solid #EDEDED' : undefined,
  };

  return (
    <div
      className={`unif-swatch ${copied ? 'unif-swatch--copied' : ''}`}
      onClick={copy}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? copy() : null)}
      role="button"
      tabIndex={0}
      title={`点击复制 ${hex}`}
    >
      <div className="unif-swatch__chip" style={chipStyle} />
      <div className="unif-swatch__name">{name}</div>
      <div className="unif-swatch__hex">{hex}</div>
      {desc ? <div className="unif-swatch__desc">{desc}</div> : null}
    </div>
  );
}
