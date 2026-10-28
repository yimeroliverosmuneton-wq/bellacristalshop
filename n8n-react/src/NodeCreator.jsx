import React, { useEffect, useRef, useState } from 'react';
import { NODE_TYPES, GROUPS } from './nodes.js';

export default function NodeCreator({ onPick, onClose, title, hideTriggers }) {
  const [q, setQ] = useState('');
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const entries = Object.entries(NODE_TYPES).filter(([, d]) =>
    (!hideTriggers || !d.trigger) && norm(`${d.label} ${d.description}`).includes(norm(q)));

  return (
    <aside className="creator" onKeyDown={(e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && entries[0]) onPick(entries[0][0]);
    }}>
      <header>
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} title="Cerrar">✕</button>
      </header>
      <input ref={input} className="search" placeholder="Buscar nodos…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="creator-list">
        {GROUPS.map((g) => {
          const items = entries.filter(([, d]) => d.group === g);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h3>{g}</h3>
              {items.map(([type, d]) => (
                <button key={type} className="creator-item" onClick={() => onPick(type)}>
                  <span className="creator-icon" style={{ color: d.color }}>{d.icon}</span>
                  <span><strong>{d.label}</strong><small>{d.description}</small></span>
                </button>
              ))}
            </section>
          );
        })}
        {!entries.length && <p className="muted">No hay nodos con ese nombre.</p>}
      </div>
    </aside>
  );
}
