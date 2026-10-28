import React, { useState } from 'react';

const cell = (v) => {
  if (v == null) return <span className="muted">—</span>;
  if (typeof v === 'object') return <code>{JSON.stringify(v)}</code>;
  return String(v);
};

const fieldExpr = (key) => `{{ $json${/^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`} }}`;

// Muestra elementos como tabla o JSON. Las columnas se pueden arrastrar a un parámetro.
export default function DataView({ title, groups, empty, draggable }) {
  const [mode, setMode] = useState('table');
  const [tab, setTab] = useState(0);
  const visible = groups.filter((g) => g.items);
  const current = visible[Math.min(tab, visible.length - 1)];
  const items = current?.items ?? [];
  const cols = [...new Set(items.slice(0, 100).flatMap((it) => Object.keys(it.json ?? {})))];

  return (
    <section className="data-view">
      <header>
        <h3>{title}</h3>
        {items.length > 0 && (
          <div className="seg">
            <button className={mode === 'table' ? 'on' : ''} onClick={() => setMode('table')}>Tabla</button>
            <button className={mode === 'json' ? 'on' : ''} onClick={() => setMode('json')}>JSON</button>
          </div>
        )}
      </header>
      {visible.length > 1 && (
        <div className="tabs small">
          {visible.map((g, i) => (
            <button key={i} className={current === g ? 'on' : ''} onClick={() => setTab(i)}>{g.label} ({g.items.length})</button>
          ))}
        </div>
      )}
      {current && <p className="muted count">{items.length} {items.length === 1 ? 'elemento' : 'elementos'}</p>}
      <div className="data-body">
        {!current && <p className="muted center">{empty}</p>}
        {current && !items.length && <p className="muted center">Esta salida no tiene elementos.</p>}
        {items.length > 0 && mode === 'json' && <pre className="json">{JSON.stringify(items.map((i) => i.json), null, 2)}</pre>}
        {items.length > 0 && mode === 'table' && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                {cols.map((c) => (
                  <th key={c} draggable={draggable} title={draggable ? 'Arrastre a un parámetro' : undefined}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', fieldExpr(c))}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 200).map((it, i) => (
                <tr key={i}><td className="muted">{i + 1}</td>{cols.map((c) => <td key={c}>{cell(it.json?.[c])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
