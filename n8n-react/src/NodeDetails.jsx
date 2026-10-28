import React, { useEffect, useState } from 'react';
import { NODE_TYPES } from './nodes.js';
import { collectInputs } from './engine.js';
import { evaluate, isExpression, makeScope } from './expr.js';
import DataView from './DataView.jsx';

const FIELD_TYPES = [['string', 'Texto'], ['number', 'Número'], ['boolean', 'Sí/No'], ['json', 'JSON']];

function Preview({ value, scope }) {
  if (!isExpression(value)) return null;
  let text; let error = false;
  try {
    const r = evaluate(value, scope);
    text = typeof r === 'object' ? JSON.stringify(r) : String(r);
  } catch (e) { text = e.message; error = true; }
  return <div className={`preview ${error ? 'error' : ''}`}><span>Resultado:</span> {text}</div>;
}

function FieldsEditor({ value = [], onChange, withType, scope }) {
  const set = (i, patch) => onChange(value.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  return (
    <div className="fields">
      {value.map((f, i) => (
        <div key={i} className="field-row">
          <div className="field-inputs">
            <input placeholder="nombre" value={f.name} onChange={(e) => set(i, { name: e.target.value })} />
            {withType && (
              <select value={f.type || 'string'} onChange={(e) => set(i, { type: e.target.value })}>
                {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            <input className={isExpression(f.value) ? 'expr' : ''} placeholder="valor o {{ expresión }}" value={f.value ?? ''} onChange={(e) => set(i, { value: e.target.value })} />
            <button className="icon-btn" title="Quitar" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
          </div>
          <Preview value={f.value} scope={scope} />
        </div>
      ))}
      <button className="btn ghost small" onClick={() => onChange([...value, { name: '', type: 'string', value: '' }])}>+ Agregar campo</button>
    </div>
  );
}

function ParamInput({ spec, value, onChange, scope }) {
  switch (spec.type) {
    case 'select':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {spec.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
    case 'boolean':
      return (
        <label className="switch">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span />
        </label>
      );
    case 'code':
      return (
        <>
          <textarea className="code" spellCheck={false} rows={spec.rows || 8} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              e.preventDefault();
              const t = e.target; const { selectionStart: a, selectionEnd: b } = t;
              onChange(`${t.value.slice(0, a)}  ${t.value.slice(b)}`);
              requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 2; });
            }} />
          {!spec.raw && <Preview value={value} scope={scope} />}
        </>
      );
    case 'fields':
      return <FieldsEditor value={value} onChange={onChange} withType={spec.withType} scope={scope} />;
    default:
      return (
        <>
          <input className={isExpression(value) ? 'expr' : ''} inputMode={spec.type === 'number' ? 'decimal' : undefined}
            value={value ?? ''} onChange={(e) => onChange(spec.type === 'number' && !isExpression(e.target.value) && e.target.value !== '' && !Number.isNaN(Number(e.target.value)) ? Number(e.target.value) : e.target.value)} />
          <Preview value={value} scope={scope} />
        </>
      );
  }
}

export default function NodeDetails({ node, workflow, results, onChange, onRename, onClose, onRunStep, running }) {
  const def = NODE_TYPES[node.type];
  const res = results[node.id];
  const [name, setName] = useState(node.name);
  useEffect(() => setName(node.name), [node.name]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inputs = res?.input ?? (def.inputs.length ? collectInputs(workflow, node, results) : []);
  const hasInputData = inputs.some((i) => i.length);
  const scope = makeScope({ items: inputs[0] ?? [], index: 0, results, nodes: workflow.nodes, workflow });
  const params = { ...Object.fromEntries(def.params.map((p) => [p.name, p.default])), ...node.params };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ndv" role="dialog" aria-label={node.name}>
        {def.inputs.length > 0 && (
          <DataView
            title="Entrada"
            draggable
            groups={def.inputs.map((label, i) => ({ label: label || 'Entrada', items: hasInputData || res ? inputs[i] : undefined }))}
            empty="Aún no hay datos. Ejecute los pasos anteriores con «Probar paso»."
          />
        )}
        <section className="params">
          <header>
            <span className="node-icon sm" style={{ color: def.color }}>{def.icon}</span>
            <input className="title-input" value={name} onChange={(e) => setName(e.target.value)}
              onBlur={() => onRename(name)} onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />
            <button className="btn primary small" disabled={running} onClick={onRunStep}>{running ? 'Ejecutando…' : 'Probar paso'}</button>
            <button className="icon-btn" onClick={onClose} title="Cerrar (Esc)">✕</button>
          </header>
          <p className="muted">{def.description}</p>
          {def.params.length === 0 && <p className="muted">Este nodo no tiene parámetros.</p>}
          {def.params.filter((p) => !p.show || p.show(params)).map((spec) => (
            <div key={spec.name} className="param">
              <label>{spec.label}</label>
              <ParamInput spec={spec} value={params[spec.name]} scope={scope}
                onChange={(v) => onChange({ params: { ...node.params, [spec.name]: v } })} />
            </div>
          ))}
          {def.params.some((p) => p.type !== 'select' && p.type !== 'boolean' && !p.raw) && (
            <p className="hint">Use <code>{'{{ $json.campo }}'}</code> para tomar datos de la entrada, o arrastre una columna de la tabla de la izquierda. También: <code>{"{{ $('Nombre del nodo').first().json }}"}</code>, <code>{'{{ $now }}'}</code>.</p>
          )}
          {node.type === 'scheduleTrigger' && <p className="hint">Solo corre mientras esta pestaña esté abierta y el flujo esté <strong>activo</strong>.</p>}
        </section>
        <section className="data-col">
          {res?.status === 'error' ? (
            <div className="error-box"><h3>Error en el nodo</h3><p>{res.error}</p></div>
          ) : (
            <DataView
              title={`Salida${res?.time != null ? ` · ${res.time} ms` : ''}`}
              groups={def.outputs.map((label, i) => ({ label: label || 'Salida', items: res?.output?.[i] }))}
              empty="Pulse «Probar paso» para ver lo que entrega este nodo."
            />
          )}
          {res?.logs?.length > 0 && (
            <div className="logs"><h3>Consola</h3><pre>{res.logs.join('\n')}</pre></div>
          )}
        </section>
      </div>
    </div>
  );
}
