import { NODE_TYPES, defaultParams } from './nodes.js';

const KEY = 'flujos:workflows';
const EXEC_KEY = 'flujos:executions';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function uniqueName(base, nodes) {
  const names = new Set(nodes.map((n) => n.name));
  if (!names.has(base)) return base;
  let i = 1;
  while (names.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function createNode(type, x, y, nodes) {
  return { id: uid(), type, name: uniqueName(NODE_TYPES[type].label, nodes), x, y, params: defaultParams(type) };
}

export function emptyWorkflow(name = 'Mi flujo') {
  return { id: uid(), name, active: false, nodes: [], connections: [], updatedAt: Date.now() };
}

export function exampleWorkflow() {
  const n = (id, type, name, x, y, params = {}) => ({ id, type, name, x, y, params: { ...defaultParams(type), ...params } });
  const nodes = [
    n('t1', 'manualTrigger', 'Disparador manual', 0, 200),
    n('d1', 'staticData', 'Pedidos del día', 200, 200),
    n('i1', 'if', '¿Envío gratis?', 400, 200),
    n('s1', 'set', 'Envío gratis', 620, 80, {
      fields: [
        { name: 'envio', type: 'number', value: '0' },
        { name: 'mensaje', type: 'string', value: 'Hola {{ $json.clienta.split(" ")[0] }}, tu pedido #{{ $json.pedido }} tiene envío gratis 🎁' },
      ],
    }),
    n('s2', 'set', 'Cobrar envío', 620, 320, {
      fields: [
        { name: 'envio', type: 'number', value: '12000' },
        { name: 'mensaje', type: 'string', value: 'Hola {{ $json.clienta.split(" ")[0] }}, tu pedido #{{ $json.pedido }} suma {{ $json.total + 12000 }} con envío' },
      ],
    }),
    n('m1', 'merge', 'Unir', 840, 200),
    n('c1', 'code', 'Total a cobrar', 1040, 200, {
      jsCode: 'return items.map(({ json }) => ({\n  ...json,\n  totalConEnvio: json.total + json.envio,\n}));',
    }),
    n('r1', 'summarize', 'Ventas del día', 1240, 200, { field: 'totalConEnvio' }),
  ];
  const c = (from, to, fromOutput = 0, toInput = 0) => ({ id: uid(), from, fromOutput, to, toInput });
  return {
    ...emptyWorkflow('Ejemplo: pedidos de Bella Cristal'),
    nodes,
    connections: [c('t1', 'd1'), c('d1', 'i1'), c('i1', 's1', 0), c('i1', 's2', 1), c('s1', 'm1', 0, 0), c('s2', 'm1', 0, 1), c('m1', 'c1'), c('c1', 'r1')],
  };
}

const read = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

export function loadState() {
  const state = read(KEY, null);
  if (state?.workflows?.length) return state;
  const wf = exampleWorkflow();
  return { workflows: [wf], currentId: wf.id };
}

export const saveState = (state) => write(KEY, state);

export const loadExecutions = () => read(EXEC_KEY, []);
// Se guardan solo las últimas ejecuciones para no llenar el almacenamiento del navegador.
export const saveExecutions = (list) => write(EXEC_KEY, list.slice(0, 25));
