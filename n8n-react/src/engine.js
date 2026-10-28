import { NODE_TYPES } from './nodes.js';
import { evaluate, makeScope } from './expr.js';

// Resuelve expresiones dentro de un valor (texto, lista o objeto) para un elemento.
function resolveDeep(value, scope) {
  if (typeof value === 'string') return evaluate(value, scope);
  if (Array.isArray(value)) return value.map((v) => resolveDeep(v, scope));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveDeep(v, scope)]));
  return value;
}

export function resolveParam(node, name, { items, index = 0, results, workflow }) {
  const def = NODE_TYPES[node.type];
  const spec = def.params.find((p) => p.name === name);
  const raw = node.params?.[name] ?? spec?.default;
  if (spec?.raw) return raw;
  return resolveDeep(raw, makeScope({ items, index, results, nodes: workflow.nodes, workflow }));
}

// Datos que recibe un nodo, por entrada, a partir de los resultados ya calculados.
export function collectInputs(workflow, node, results) {
  const def = NODE_TYPES[node.type];
  return def.inputs.map((_, inputIndex) =>
    workflow.connections
      .filter((c) => c.to === node.id && c.toInput === inputIndex)
      .flatMap((c) => results[c.from]?.output?.[c.fromOutput] ?? []),
  );
}

function reachableFrom(starts, edges, key) {
  const seen = new Set(starts);
  const stack = [...starts];
  while (stack.length) {
    const id = stack.pop();
    edges.forEach((c) => {
      const [a, b] = key === 'down' ? [c.from, c.to] : [c.to, c.from];
      if (a === id && !seen.has(b)) { seen.add(b); stack.push(b); }
    });
  }
  return seen;
}

/**
 * Ejecuta el flujo desde los disparadores indicados (o todos).
 * Si se da `destination`, solo corre ese nodo y los que lo alimentan.
 * onUpdate recibe los resultados parciales cada vez que avanza un nodo.
 */
export async function runWorkflow(workflow, { triggerIds, destination, onUpdate = () => {}, isCancelled = () => false } = {}) {
  const nodes = workflow.nodes;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const connections = workflow.connections.filter((c) => byId[c.from] && byId[c.to]);

  let triggers = nodes.filter((n) => NODE_TYPES[n.type].trigger && (!triggerIds || triggerIds.includes(n.id)));
  let scope = reachableFrom(triggers.map((n) => n.id), connections, 'down');
  if (destination) {
    const upstream = reachableFrom([destination], connections, 'up');
    scope = new Set([...scope].filter((id) => upstream.has(id)));
    triggers = triggers.filter((t) => scope.has(t.id));
  }
  if (!triggers.length) throw new Error(destination ? 'Este nodo no está conectado a ningún disparador.' : 'Agregue un disparador (por ejemplo «Disparador manual») para empezar.');

  // Orden topológico dentro del alcance.
  const pending = new Map([...scope].map((id) => [id, connections.filter((c) => c.to === id && scope.has(c.from)).length]));
  const order = [];
  const ready = [...pending].filter(([, n]) => n === 0).map(([id]) => id).sort((a, b) => byId[a].y - byId[b].y);
  while (ready.length) {
    const id = ready.shift();
    order.push(id);
    connections.filter((c) => c.from === id && scope.has(c.to)).forEach((c) => {
      pending.set(c.to, pending.get(c.to) - 1);
      if (pending.get(c.to) === 0) ready.push(c.to);
    });
  }
  if (order.length < scope.size) throw new Error('El flujo tiene un ciclo; quite la conexión que vuelve hacia atrás.');

  const results = {};
  for (const id of order) {
    if (isCancelled()) return { status: 'cancelled', results };
    const node = byId[id];
    const def = NODE_TYPES[node.type];
    const inputs = collectInputs({ ...workflow, connections }, node, results);
    const isTrigger = def.inputs.length === 0;
    if (!isTrigger && inputs.every((items) => !items.length)) continue; // sin datos: el nodo no se ejecuta

    const started = performance.now();
    const logs = [];
    results[id] = { status: 'running', input: inputs };
    onUpdate({ ...results });

    if (node.disabled) {
      results[id] = { status: 'disabled', input: inputs, output: [inputs[0] ?? [], ...def.outputs.slice(1).map(() => [])], time: 0, logs };
      onUpdate({ ...results });
      continue;
    }
    try {
      const items = inputs[0] ?? [];
      const ctx = {
        node, items, inputs,
        log: (msg) => logs.push(msg),
        param: (name, index = 0) => resolveParam(node, name, { items, index, results, workflow }),
      };
      const output = await def.run(ctx);
      results[id] = { status: 'success', input: inputs, output, time: Math.round(performance.now() - started), logs };
      onUpdate({ ...results });
    } catch (e) {
      results[id] = { status: 'error', input: inputs, error: e.message || String(e), time: Math.round(performance.now() - started), logs };
      onUpdate({ ...results });
      return { status: 'error', results, error: `${node.name}: ${results[id].error}` };
    }
  }
  return { status: 'success', results };
}
