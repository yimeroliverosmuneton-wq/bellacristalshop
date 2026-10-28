import React, { useEffect, useRef, useState } from 'react';
import { NODE_TYPES } from './nodes.js';
import { NODE_W, NODE_H, snap, handlePos, edgePath, midpoint } from './geometry.js';

const countLabel = (n) => `${n} ${n === 1 ? 'elemento' : 'elementos'}`;

export default function Canvas({
  workflow, results, view, setView, selection, setSelection,
  onMoveNodes, onDragStart, onConnect, onOpenNode, onOpenCreator, onDeleteNode, onDeleteEdge, onToggleNode, onRunNode,
}) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [temp, setTemp] = useState(null); // línea mientras se conecta
  const latest = useRef({});
  latest.current = { view, onMoveNodes, onConnect, onOpenCreator, onDragStart, workflow };

  const toWorld = (clientX, clientY) => {
    const r = ref.current.getBoundingClientRect();
    const v = latest.current.view;
    return { x: (clientX - r.left - v.x) / v.z, y: (clientY - r.top - v.y) / v.z };
  };

  useEffect(() => {
    const el = ref.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left; const my = e.clientY - r.top;
      setView((v) => {
        if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return { ...v, x: v.x - e.deltaX };
        const z = Math.min(2.5, Math.max(0.2, v.z * Math.exp(-e.deltaY * 0.0015)));
        return { z, x: mx - ((mx - v.x) * z) / v.z, y: my - ((my - v.y) * z) / v.z };
      });
    };
    const onMove = (e) => {
      const d = drag.current;
      if (!d) return;
      if (d.kind === 'pan') {
        setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
      } else if (d.kind === 'node') {
        const dx = (e.clientX - d.sx) / latest.current.view.z;
        const dy = (e.clientY - d.sy) / latest.current.view.z;
        if (!d.moved && Math.hypot(dx, dy) < 3) return;
        if (!d.moved) { d.moved = true; latest.current.onDragStart(); }
        latest.current.onMoveNodes(Object.fromEntries(d.start.map((s) => [s.id, { x: snap(s.x + dx), y: snap(s.y + dy) }])));
      } else if (d.kind === 'connect') {
        setTemp((t) => ({ ...t, to: toWorld(e.clientX, e.clientY) }));
      }
    };
    const onUp = (e) => {
      const d = drag.current;
      drag.current = null;
      if (d?.kind !== 'connect') return;
      setTemp(null);
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const handle = hit?.closest('[data-input]');
      const nodeEl = hit?.closest('[data-node-id]');
      if (handle) {
        latest.current.onConnect({ from: d.from, fromOutput: d.output, to: handle.dataset.node, toInput: Number(handle.dataset.input) });
      } else if (nodeEl) {
        if (nodeEl.dataset.inputs !== '0') latest.current.onConnect({ from: d.from, fromOutput: d.output, to: nodeEl.dataset.nodeId, toInput: 0 });
      } else if (hit && ref.current.contains(hit)) {
        const p = toWorld(e.clientX, e.clientY);
        latest.current.onOpenCreator({ source: { nodeId: d.from, output: d.output }, at: { x: snap(p.x), y: snap(p.y - NODE_H / 2) } });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [setView]);

  const startPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    setSelection([]);
  };

  const startNodeDrag = (e, node) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    let sel = selection;
    if (e.shiftKey) sel = selection.includes(node.id) ? selection.filter((s) => s !== node.id) : [...selection, node.id];
    else if (!selection.includes(node.id)) sel = [node.id];
    setSelection(sel);
    const ids = sel.includes(node.id) ? sel : [node.id];
    drag.current = { kind: 'node', sx: e.clientX, sy: e.clientY, moved: false, start: workflow.nodes.filter((n) => ids.includes(n.id)).map((n) => ({ id: n.id, x: n.x, y: n.y })) };
  };

  const startConnect = (e, node, output) => {
    e.stopPropagation();
    const from = handlePos(node, 'out', output);
    drag.current = { kind: 'connect', from: node.id, output };
    setTemp({ from, to: from });
  };

  const byId = Object.fromEntries(workflow.nodes.map((n) => [n.id, n]));
  const connected = new Set(workflow.connections.map((c) => `${c.from}:${c.fromOutput}`));
  const gridSize = 20 * view.z;

  return (
    <div
      ref={ref}
      className="canvas"
      onPointerDown={startPan}
      style={{ backgroundSize: `${gridSize}px ${gridSize}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <div className="world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
        <svg className="edges">
          {workflow.connections.map((c) => {
            const a = byId[c.from]; const b = byId[c.to];
            if (!a || !b) return null;
            const p1 = handlePos(a, 'out', c.fromOutput);
            const p2 = handlePos(b, 'in', c.toInput);
            const out = results[c.from]?.output?.[c.fromOutput];
            const sel = selection.includes(c.id);
            const m = midpoint(p1, p2);
            return (
              <g key={c.id} className={`edge ${out ? 'ran' : ''} ${sel ? 'selected' : ''}`}>
                <path d={edgePath(p1, p2)} className="edge-hit" onPointerDown={(e) => { e.stopPropagation(); setSelection([c.id]); }} />
                <path d={edgePath(p1, p2)} className="edge-line" markerEnd="url(#arrow)" />
                {out && <text x={m.x} y={m.y - 8} className="edge-count">{countLabel(out.length)}</text>}
                {sel && (
                  <g className="edge-delete" transform={`translate(${m.x} ${m.y})`} onPointerDown={(e) => { e.stopPropagation(); onDeleteEdge(c.id); }}>
                    <circle r="11" /><text y="4">✕</text>
                  </g>
                )}
              </g>
            );
          })}
          {temp && <path d={edgePath(temp.from, temp.to)} className="edge-line temp" />}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="arrow" />
            </marker>
          </defs>
        </svg>

        {workflow.nodes.map((node) => {
          const def = NODE_TYPES[node.type];
          const res = results[node.id];
          const sel = selection.includes(node.id);
          return (
            <div
              key={node.id}
              className={`node ${def.trigger ? 'trigger' : ''} ${sel ? 'selected' : ''} ${node.disabled ? 'disabled' : ''} ${res ? `st-${res.status}` : ''}`}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H, '--c': def.color }}
              onPointerDown={(e) => startNodeDrag(e, node)}
              onDoubleClick={() => onOpenNode(node.id)}
              data-node-id={node.id}
              data-inputs={def.inputs.length}
            >
              <div className="node-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                <button title="Ejecutar hasta aquí" onClick={() => onRunNode(node.id)}>▶</button>
                <button title={node.disabled ? 'Activar' : 'Desactivar'} onClick={() => onToggleNode(node.id)}>⏻</button>
                <button title="Eliminar" onClick={() => onDeleteNode(node.id)}>🗑</button>
              </div>
              <div className="node-icon" style={{ color: def.color }}>{def.icon}</div>
              {res?.status === 'success' && <span className="node-badge ok" title={`${res.time} ms`}>✓</span>}
              {res?.status === 'error' && <span className="node-badge err" title={res.error}>!</span>}
              {res?.status === 'running' && <span className="node-badge run" />}
              <div className="node-label">
                <strong>{node.name}</strong>
                {node.disabled && <small>(desactivado)</small>}
              </div>

              {def.inputs.map((label, i) => {
                const p = handlePos({ ...node, x: 0, y: 0 }, 'in', i);
                return (
                  <div key={`in${i}`} className="handle in" style={{ left: p.x, top: p.y }} data-node={node.id} data-input={i} title={label || 'Entrada'}>
                    {label && <span className="handle-label in">{label}</span>}
                  </div>
                );
              })}
              {def.outputs.map((label, i) => {
                const p = handlePos({ ...node, x: 0, y: 0 }, 'out', i);
                const free = !connected.has(`${node.id}:${i}`);
                return (
                  <React.Fragment key={`out${i}`}>
                    <div className="handle out" style={{ left: p.x, top: p.y }} onPointerDown={(e) => startConnect(e, node, i)} title="Arrastre para conectar">
                      {label && <span className="handle-label out">{label}</span>}
                    </div>
                    {free && (
                      <button
                        className="add-after"
                        style={{ left: p.x + 44, top: p.y }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onOpenCreator({ source: { nodeId: node.id, output: i } })}
                        title="Agregar nodo"
                      >
                        +
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })}
      </div>

      {!workflow.nodes.length && (
        <button className="first-step" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpenCreator({})}>
          <span>+</span>Agregar el primer paso
        </button>
      )}
    </div>
  );
}
