import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Canvas from './Canvas.jsx';
import NodeCreator from './NodeCreator.jsx';
import NodeDetails from './NodeDetails.jsx';
import { NODE_TYPES } from './nodes.js';
import { runWorkflow } from './engine.js';
import { NODE_W, NODE_H, snap } from './geometry.js';
import {
  loadState, saveState, loadExecutions, saveExecutions, emptyWorkflow, exampleWorkflow, createNode, uniqueName, uid,
} from './storage.js';

const UNIT_MS = { seconds: 1000, minutes: 60000, hours: 3600000 };
const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
const formatDate = (t) => new Date(t).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });

export default function App() {
  const [state, setState] = useState(loadState);
  const wf = state.workflows.find((w) => w.id === state.currentId) ?? state.workflows[0];
  const wfRef = useRef(wf);
  wfRef.current = wf;

  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [executions, setExecutions] = useState(loadExecutions);
  const [tab, setTab] = useState('editor');
  const [selection, setSelection] = useState([]);
  const [openNodeId, setOpenNodeId] = useState(null);
  const [creator, setCreator] = useState(null);
  const [menu, setMenu] = useState(false);
  const [view, setView] = useState({ x: 80, y: 80, z: 1 });
  const [toast, setToast] = useState(null);
  const past = useRef([]);
  const clipboard = useRef(null);
  const main = useRef(null);
  const fileInput = useRef(null);

  const notify = useCallback((text, kind = 'info') => {
    setToast({ text, kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { if (!saveState(state)) notify('No se pudo guardar en este navegador', 'error'); }, [state, notify]);
  useEffect(() => { saveExecutions(executions); }, [executions]);

  // ---- Edición del flujo -------------------------------------------------
  const updateWf = useCallback((fn, { history = true } = {}) => {
    setState((s) => ({
      ...s,
      workflows: s.workflows.map((w) => {
        if (w.id !== s.currentId) return w;
        if (history) past.current = [...past.current.slice(-49), w];
        return { ...fn(w), updatedAt: Date.now() };
      }),
    }));
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    setState((s) => ({ ...s, workflows: s.workflows.map((w) => (w.id === prev.id ? prev : w)) }));
  }, []);

  const pushHistory = useCallback(() => { past.current = [...past.current.slice(-49), wfRef.current]; }, []);

  const moveNodes = useCallback((positions) => {
    updateWf((w) => ({ ...w, nodes: w.nodes.map((n) => (positions[n.id] ? { ...n, ...positions[n.id] } : n)) }), { history: false });
  }, [updateWf]);

  const connect = useCallback(({ from, fromOutput, to, toInput }) => {
    if (from === to) return;
    updateWf((w) => {
      if (w.connections.some((c) => c.from === from && c.fromOutput === fromOutput && c.to === to && c.toInput === toInput)) return w;
      return { ...w, connections: [...w.connections, { id: uid(), from, fromOutput, to, toInput }] };
    });
  }, [updateWf]);

  const deleteItems = useCallback((ids) => {
    updateWf((w) => {
      const nodeIds = new Set(ids.filter((id) => w.nodes.some((n) => n.id === id)));
      let connections = w.connections.filter((c) => !ids.includes(c.id));
      // Al borrar un nodo intermedio se unen el anterior y el siguiente, como en n8n.
      nodeIds.forEach((id) => {
        const ins = connections.filter((c) => c.to === id);
        const outs = connections.filter((c) => c.from === id);
        connections = connections.filter((c) => c.to !== id && c.from !== id);
        if (ins.length === 1 && outs.length >= 1 && !nodeIds.has(ins[0].from)) {
          outs.filter((o) => !nodeIds.has(o.to)).forEach((o) => connections.push({ id: uid(), from: ins[0].from, fromOutput: ins[0].fromOutput, to: o.to, toInput: o.toInput }));
        }
      });
      return { ...w, nodes: w.nodes.filter((n) => !nodeIds.has(n.id)), connections };
    });
    setSelection([]);
  }, [updateWf]);

  const patchNode = useCallback((id, patch) => {
    updateWf((w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  }, [updateWf]);

  const renameNode = (id, wanted) => {
    const node = wf.nodes.find((n) => n.id === id);
    const name = wanted.trim();
    if (!node || !name || name === node.name) return;
    const finalName = uniqueName(name, wf.nodes.filter((n) => n.id !== id));
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ref = new RegExp(`\\$\\((['"])${esc(node.name)}\\1\\)`, 'g');
    updateWf((w) => ({
      ...w,
      nodes: w.nodes.map((n) => (n.id === id
        ? { ...n, name: finalName }
        : { ...n, params: JSON.parse(JSON.stringify(n.params).replace(ref, (_, q) => `$(${q}${finalName}${q})`)) })),
    }));
  };

  const copySelection = () => {
    const nodes = wf.nodes.filter((n) => selection.includes(n.id));
    if (!nodes.length) return false;
    const ids = new Set(nodes.map((n) => n.id));
    clipboard.current = { nodes, connections: wf.connections.filter((c) => ids.has(c.from) && ids.has(c.to)) };
    return true;
  };

  const paste = (offset = 40) => {
    const clip = clipboard.current;
    if (!clip) return;
    const map = {};
    updateWf((w) => {
      const all = [...w.nodes];
      const nodes = clip.nodes.map((n) => {
        const copy = { ...structuredClone(n), id: uid(), name: uniqueName(n.name, all), x: n.x + offset, y: n.y + offset };
        map[n.id] = copy.id;
        all.push(copy);
        return copy;
      });
      const connections = clip.connections.map((c) => ({ ...c, id: uid(), from: map[c.from], to: map[c.to] }));
      return { ...w, nodes: [...w.nodes, ...nodes], connections: [...w.connections, ...connections] };
    });
    setSelection(Object.values(map));
  };

  // ---- Vista ---------------------------------------------------------------
  const fitView = useCallback(() => {
    const el = main.current;
    const nodes = wfRef.current.nodes;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!nodes.length) { setView({ x: width / 2, y: height / 2, z: 1 }); return; }
    const minX = Math.min(...nodes.map((n) => n.x)) - 60;
    const minY = Math.min(...nodes.map((n) => n.y)) - 60;
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 100;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + 80;
    const z = Math.min(1.2, Math.max(0.2, Math.min(width / (maxX - minX), (height - 80) / (maxY - minY))));
    setView({ z, x: (width - (maxX - minX) * z) / 2 - minX * z, y: (height - 80 - (maxY - minY) * z) / 2 - minY * z });
  }, []);

  useLayoutEffect(() => { fitView(); }, [state.currentId, fitView]);

  const zoom = (factor) => {
    const { width, height } = main.current.getBoundingClientRect();
    setView((v) => {
      const z = Math.min(2.5, Math.max(0.2, v.z * factor));
      return { z, x: width / 2 - ((width / 2 - v.x) * z) / v.z, y: height / 2 - ((height / 2 - v.y) * z) / v.z };
    });
  };

  // ---- Nodos nuevos --------------------------------------------------------
  const addNode = (type) => {
    const { source, at } = creator || {};
    const def = NODE_TYPES[type];
    let pos = at;
    if (!pos && source) {
      const s = wf.nodes.find((n) => n.id === source.nodeId);
      const outs = NODE_TYPES[s.type].outputs.length;
      pos = { x: s.x + 220, y: s.y + (outs > 1 ? (source.output - (outs - 1) / 2) * 160 : 0) };
    }
    if (!pos) {
      const { width, height } = main.current.getBoundingClientRect();
      pos = { x: snap((width / 2 - view.x) / view.z - NODE_W / 2), y: snap((height / 2 - view.y) / view.z - NODE_H / 2) };
    }
    const node = createNode(type, pos.x, pos.y, wf.nodes);
    updateWf((w) => ({
      ...w,
      nodes: [...w.nodes, node],
      connections: source && def.inputs.length
        ? [...w.connections, { id: uid(), from: source.nodeId, fromOutput: source.output, to: node.id, toInput: 0 }]
        : w.connections,
    }));
    setCreator(null);
    setSelection([node.id]);
    if (def.params.length) setOpenNodeId(node.id);
  };

  // ---- Ejecución -----------------------------------------------------------
  const execute = useCallback(async ({ triggerIds, destination, mode = 'manual' } = {}) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setResults({});
    const workflow = wfRef.current;
    const startedAt = Date.now();
    let out;
    try {
      out = await runWorkflow(workflow, { triggerIds, destination, onUpdate: setResults });
    } catch (e) {
      out = { status: 'error', error: e.message, results: {} };
    }
    setResults(out.results);
    runningRef.current = false;
    setRunning(false);
    if (mode === 'manual') notify(out.status === 'success' ? 'Flujo ejecutado correctamente' : out.error, out.status === 'success' ? 'ok' : 'error');
    setExecutions((list) => [{
      id: uid(), workflowId: workflow.id, workflowName: workflow.name, mode, status: out.status, error: out.error,
      startedAt, duration: Date.now() - startedAt, results: out.results,
    }, ...list].slice(0, 25));
  }, [notify]);

  // Disparadores programados: corren mientras el flujo esté activo y la página abierta.
  const scheduleKey = JSON.stringify(wf.nodes.filter((n) => n.type === 'scheduleTrigger' && !n.disabled).map((n) => [n.id, n.params]));
  useEffect(() => {
    if (!wf.active) return undefined;
    const timers = JSON.parse(scheduleKey).map(([id, p]) => {
      const ms = Math.max(1000, Number(p.every || 1) * (UNIT_MS[p.unit] || 60000));
      return setInterval(() => execute({ triggerIds: [id], mode: 'programado' }), ms);
    });
    return () => timers.forEach(clearInterval);
  }, [wf.active, scheduleKey, execute]);

  // ---- Flujos --------------------------------------------------------------
  const switchTo = (id) => {
    past.current = [];
    setResults({});
    setSelection([]);
    setOpenNodeId(null);
    setState((s) => ({ ...s, currentId: id }));
    setMenu(false);
  };
  const addWorkflow = (w) => {
    past.current = [];
    setResults({});
    setSelection([]);
    setState((s) => ({ workflows: [...s.workflows, w], currentId: w.id }));
    setMenu(false);
  };
  const deleteWorkflow = () => {
    if (!window.confirm(`¿Eliminar el flujo «${wf.name}»? Esta acción no se puede deshacer.`)) return;
    setState((s) => {
      const rest = s.workflows.filter((w) => w.id !== wf.id);
      const workflows = rest.length ? rest : [emptyWorkflow()];
      return { workflows, currentId: workflows[0].id };
    });
    setResults({});
    setMenu(false);
  };
  const exportWorkflow = () => {
    const { id, updatedAt, ...data } = wf;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${wf.name.replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '').trim() || 'flujo'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMenu(false);
  };
  const importWorkflow = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.nodes) || !Array.isArray(data.connections)) throw new Error('faltan «nodes» o «connections»');
      const unknown = data.nodes.find((n) => !NODE_TYPES[n.type]);
      if (unknown) throw new Error(`tipo de nodo desconocido «${unknown.type}»`);
      addWorkflow({ ...emptyWorkflow(data.name || file.name.replace(/\.json$/, '')), nodes: data.nodes, connections: data.connections, active: false });
      notify('Flujo importado', 'ok');
    } catch (e) {
      notify(`No se pudo importar: ${e.message}`, 'error');
    }
  };

  // ---- Teclado -------------------------------------------------------------
  const keyHandler = useRef();
  keyHandler.current = (e) => {
    if (openNodeId || isTyping(document.activeElement)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { setCreator(null); setMenu(false); setSelection([]); return; }
    if (creator) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) { e.preventDefault(); deleteItems(selection); }
    else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (mod && e.key === 'Enter') { e.preventDefault(); execute(); }
    else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelection(wf.nodes.map((n) => n.id)); }
    else if (mod && e.key.toLowerCase() === 'c') { if (copySelection()) notify('Nodos copiados'); }
    else if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); paste(); }
    else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (copySelection()) paste(); }
    else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); notify('El flujo se guarda solo en este navegador', 'ok'); }
    else if (e.key === 'Tab') { e.preventDefault(); setCreator({}); }
    else if (e.key === 'Enter' && selection.length === 1 && wf.nodes.some((n) => n.id === selection[0])) setOpenNodeId(selection[0]);
    else if (e.key === '1' && e.shiftKey) fitView();
  };
  useEffect(() => {
    const onKey = (e) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openNode = wf.nodes.find((n) => n.id === openNodeId);
  const hasResults = Object.keys(results).length > 0;
  const wfExecutions = executions.filter((x) => x.workflowId === wf.id);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" title="Editor de automatizaciones inspirado en n8n">
          <span className="logo">⟿</span> Flujos
        </div>
        <div className="wf-picker">
          <button className="btn ghost" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>Flujos ▾</button>
          {menu && (
            <div className="menu" onPointerLeave={() => setMenu(false)}>
              {state.workflows.map((w) => (
                <button key={w.id} className={w.id === wf.id ? 'on' : ''} onClick={() => switchTo(w.id)}>
                  {w.active && <span className="dot" />}{w.name}
                </button>
              ))}
              <hr />
              <button onClick={() => addWorkflow(emptyWorkflow(uniqueName('Mi flujo', state.workflows)))}>+ Nuevo flujo</button>
              <button onClick={() => addWorkflow({ ...structuredClone(wf), id: uid(), name: uniqueName(`${wf.name} (copia)`, state.workflows), active: false })}>Duplicar este flujo</button>
              <button onClick={() => addWorkflow(exampleWorkflow())}>Cargar ejemplo</button>
              <button onClick={() => { fileInput.current.click(); setMenu(false); }}>Importar JSON…</button>
              <button onClick={exportWorkflow}>Exportar JSON</button>
              <hr />
              <button className="danger" onClick={deleteWorkflow}>Eliminar este flujo</button>
            </div>
          )}
          <input ref={fileInput} type="file" accept=".json,application/json" hidden
            onChange={(e) => { if (e.target.files[0]) importWorkflow(e.target.files[0]); e.target.value = ''; }} />
        </div>
        <input className="wf-name" value={wf.name} aria-label="Nombre del flujo"
          onChange={(e) => { const name = e.target.value; updateWf((w) => ({ ...w, name }), { history: false }); }} />
        <nav className="tabs">
          <button className={tab === 'editor' ? 'on' : ''} onClick={() => setTab('editor')}>Editor</button>
          <button className={tab === 'executions' ? 'on' : ''} onClick={() => setTab('executions')}>Ejecuciones{wfExecutions.length ? ` (${wfExecutions.length})` : ''}</button>
        </nav>
        <label className="active-toggle" title="Activa los disparadores programados">
          <span>{wf.active ? 'Activo' : 'Inactivo'}</span>
          <span className="switch">
            <input type="checkbox" checked={!!wf.active} onChange={(e) => {
              const active = e.target.checked;
              if (active && !wf.nodes.some((n) => n.type === 'scheduleTrigger' && !n.disabled)) notify('Agregue un disparador «Programado» para que el flujo corra solo');
              updateWf((w) => ({ ...w, active }), { history: false });
            }} />
            <span />
          </span>
        </label>
      </header>

      <main ref={main} className="main">
        {tab === 'editor' ? (
          <>
            <Canvas
              workflow={wf}
              results={results}
              view={view}
              setView={setView}
              selection={selection}
              setSelection={setSelection}
              onMoveNodes={moveNodes}
              onDragStart={pushHistory}
              onConnect={connect}
              onOpenNode={setOpenNodeId}
              onOpenCreator={setCreator}
              onDeleteNode={(id) => deleteItems([id])}
              onDeleteEdge={(id) => deleteItems([id])}
              onToggleNode={(id) => patchNode(id, { disabled: !wf.nodes.find((n) => n.id === id).disabled })}
              onRunNode={(id) => execute({ destination: id })}
            />
            <button className="fab" title="Agregar nodo (Tab)" onClick={() => setCreator({})}>+</button>
            <div className="zoom">
              <button onClick={() => zoom(1.2)} title="Acercar">＋</button>
              <button onClick={() => zoom(1 / 1.2)} title="Alejar">－</button>
              <button onClick={fitView} title="Ajustar a la pantalla (Shift+1)">⤢</button>
              <button onClick={undo} title="Deshacer (Ctrl+Z)" disabled={!past.current.length}>↶</button>
            </div>
            {wf.nodes.length > 0 && (
              <div className="run-bar">
                <button className="btn primary big" disabled={running} onClick={() => execute()}>
                  {running ? <><span className="spinner" /> Ejecutando…</> : <>▶ Ejecutar flujo</>}
                </button>
                {hasResults && !running && <button className="btn ghost" onClick={() => setResults({})} title="Borrar los datos de la última ejecución">Limpiar</button>}
              </div>
            )}
            {creator && (
              <NodeCreator
                title={creator.source ? '¿Qué pasa después?' : wf.nodes.length ? 'Agregar nodo' : '¿Qué inicia este flujo?'}
                hideTriggers={!!creator.source}
                onPick={addNode}
                onClose={() => setCreator(null)}
              />
            )}
          </>
        ) : (
          <section className="executions">
            <h2>Ejecuciones de «{wf.name}»</h2>
            {!wfExecutions.length && <p className="muted">Aún no hay ejecuciones. Vuelva al editor y pulse «Ejecutar flujo».</p>}
            {wfExecutions.length > 0 && (
              <table>
                <thead><tr><th>Inicio</th><th>Modo</th><th>Estado</th><th>Duración</th><th /></tr></thead>
                <tbody>
                  {wfExecutions.map((x) => (
                    <tr key={x.id}>
                      <td>{formatDate(x.startedAt)}</td>
                      <td>{x.mode}</td>
                      <td><span className={`pill ${x.status}`}>{{ success: 'Correcta', error: 'Error', cancelled: 'Cancelada' }[x.status] || x.status}</span>{x.error && <small className="muted"> {x.error}</small>}</td>
                      <td>{x.duration} ms</td>
                      <td><button className="btn ghost small" onClick={() => { setResults(x.results || {}); setTab('editor'); }}>Ver en el editor</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </main>

      {openNode && (
        <NodeDetails
          node={openNode}
          workflow={wf}
          results={results}
          running={running}
          onChange={(patch) => patchNode(openNode.id, patch)}
          onRename={(name) => renameNode(openNode.id, name)}
          onClose={() => setOpenNodeId(null)}
          onRunStep={() => execute({ destination: openNode.id })}
        />
      )}
      {toast && <div key={toast.id} className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
