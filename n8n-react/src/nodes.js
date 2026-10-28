import { getPath, setPath } from './expr.js';

// Cada tipo de nodo define sus entradas, salidas, parámetros y la función que lo ejecuta.
// run(ctx) devuelve un arreglo por salida, cada uno con elementos { json }.
// ctx: { items, inputs, param(nombre, índice), node, log }

const OPERATORS = [
  ['equals', 'es igual a'],
  ['notEquals', 'no es igual a'],
  ['gt', 'mayor que'],
  ['gte', 'mayor o igual que'],
  ['lt', 'menor que'],
  ['lte', 'menor o igual que'],
  ['contains', 'contiene'],
  ['notContains', 'no contiene'],
  ['startsWith', 'empieza por'],
  ['endsWith', 'termina en'],
  ['isEmpty', 'está vacío'],
  ['isNotEmpty', 'no está vacío'],
  ['regex', 'coincide con regex'],
];

const isEmptyValue = (v) =>
  v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Object.keys(v).length);

export function compare(a, op, b) {
  const num = (x) => (typeof x === 'number' ? x : Number(String(x).replace(',', '.')));
  switch (op) {
    case 'equals': return a == b; // eslint-disable-line eqeqeq
    case 'notEquals': return a != b; // eslint-disable-line eqeqeq
    case 'gt': return num(a) > num(b);
    case 'gte': return num(a) >= num(b);
    case 'lt': return num(a) < num(b);
    case 'lte': return num(a) <= num(b);
    case 'contains': return String(a ?? '').includes(String(b ?? ''));
    case 'notContains': return !String(a ?? '').includes(String(b ?? ''));
    case 'startsWith': return String(a ?? '').startsWith(String(b ?? ''));
    case 'endsWith': return String(a ?? '').endsWith(String(b ?? ''));
    case 'isEmpty': return isEmptyValue(a);
    case 'isNotEmpty': return !isEmptyValue(a);
    case 'regex': return new RegExp(String(b)).test(String(a ?? ''));
    default: throw new Error(`Operador desconocido: ${op}`);
  }
}

const conditionParams = [
  { name: 'value1', label: 'Valor', type: 'string', default: '{{ $json.total }}' },
  { name: 'operator', label: 'Operación', type: 'select', options: OPERATORS, default: 'gte' },
  { name: 'value2', label: 'Comparar con', type: 'string', default: '100000', show: (p) => !['isEmpty', 'isNotEmpty'].includes(p.operator) },
];

const testCondition = (ctx, i) => compare(ctx.param('value1', i), ctx.param('operator', i), ctx.param('value2', i));

const parseJson = (text, what) => {
  if (typeof text !== 'string') return text;
  try { return JSON.parse(text); } catch (e) { throw new Error(`${what} no es un JSON válido: ${e.message}`); }
};

const toItems = (data) => (Array.isArray(data) ? data : [data]).map((d) => (d && typeof d === 'object' && !Array.isArray(d) ? { json: d } : { json: { valor: d } }));

const castValue = (value, type) => {
  if (type === 'number') { const n = Number(String(value).replace(',', '.')); if (Number.isNaN(n)) throw new Error(`«${value}» no es un número`); return n; }
  if (type === 'boolean') return value === true || value === 'true' || value === '1' || value === 1;
  if (type === 'json') return typeof value === 'string' ? parseJson(value, 'El valor') : value;
  return value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLE_DATA = JSON.stringify([
  { pedido: 101, clienta: 'Laura Gómez', prenda: 'Pijama short satín', cantidad: 2, total: 118000 },
  { pedido: 102, clienta: 'Diana Ruiz', prenda: 'Pijama pantalón algodón', cantidad: 3, total: 207000 },
  { pedido: 103, clienta: 'Camila Torres', prenda: 'Bata satín', cantidad: 1, total: 65000 },
], null, 2);

export const GROUPS = ['Disparadores', 'Acciones', 'Transformar datos', 'Lógica', 'Utilidades'];

export const NODE_TYPES = {
  manualTrigger: {
    label: 'Disparador manual', group: 'Disparadores', icon: '▶', color: '#ff6d5a', trigger: true,
    description: 'Inicia el flujo al pulsar «Ejecutar flujo».',
    inputs: [], outputs: [''], params: [],
    run: async () => [[{ json: {} }]],
  },
  scheduleTrigger: {
    label: 'Programado', group: 'Disparadores', icon: '⏰', color: '#31c49f', trigger: true,
    description: 'Ejecuta el flujo cada cierto tiempo mientras el flujo esté activo.',
    inputs: [], outputs: [''],
    params: [
      { name: 'every', label: 'Cada', type: 'number', default: 1 },
      { name: 'unit', label: 'Unidad', type: 'select', options: [['seconds', 'Segundos'], ['minutes', 'Minutos'], ['hours', 'Horas']], default: 'minutes' },
    ],
    run: async () => {
      const d = new Date();
      return [[{ json: { marcaDeTiempo: d.toISOString(), fecha: d.toLocaleDateString('es-CO'), hora: d.toLocaleTimeString('es-CO') } }]];
    },
  },
  staticData: {
    label: 'Datos fijos', group: 'Acciones', icon: '{ }', color: '#7b61ff',
    description: 'Entrega datos escritos a mano en JSON (un elemento por objeto).',
    inputs: [''], outputs: [''],
    params: [{ name: 'data', label: 'JSON', type: 'code', default: SAMPLE_DATA }],
    run: async (ctx) => [toItems(parseJson(ctx.param('data'), 'El JSON'))],
  },
  httpRequest: {
    label: 'Petición HTTP', group: 'Acciones', icon: '🌐', color: '#0088cc',
    description: 'Llama a cualquier API o página web.',
    inputs: [''], outputs: [''],
    params: [
      { name: 'method', label: 'Método', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => [m, m]), default: 'GET' },
      { name: 'url', label: 'URL', type: 'string', default: 'https://jsonplaceholder.typicode.com/users' },
      { name: 'headers', label: 'Encabezados', type: 'fields', default: [] },
      { name: 'sendBody', label: 'Enviar cuerpo', type: 'boolean', default: false, show: (p) => p.method !== 'GET' },
      { name: 'body', label: 'Cuerpo (JSON)', type: 'code', default: '{\n  "dato": "{{ $json.dato }}"\n}', show: (p) => p.method !== 'GET' && p.sendBody },
    ],
    run: async (ctx) => {
      const out = [];
      const count = Math.max(ctx.items.length, 1);
      for (let i = 0; i < count; i++) {
        const method = ctx.param('method', i);
        const url = ctx.param('url', i);
        if (!url) throw new Error('Falta la URL');
        const headers = Object.fromEntries((ctx.param('headers', i) || []).filter((h) => h.name).map((h) => [h.name, String(h.value)]));
        const init = { method, headers };
        if (method !== 'GET' && ctx.param('sendBody', i)) {
          init.body = JSON.stringify(parseJson(ctx.param('body', i), 'El cuerpo'));
          if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
        }
        let res;
        try { res = await fetch(url, init); } catch (e) { throw new Error(`No se pudo conectar con ${url} (${e.message}). Revise la URL o el CORS del servidor.`); }
        const type = res.headers.get('content-type') || '';
        const data = type.includes('json') ? await res.json() : { datos: await res.text() };
        if (!res.ok) throw new Error(`El servidor respondió ${res.status} ${res.statusText}: ${JSON.stringify(data).slice(0, 200)}`);
        out.push(...toItems(data));
      }
      return [out];
    },
  },
  set: {
    label: 'Editar campos', group: 'Transformar datos', icon: '✎', color: '#4a90e2',
    description: 'Agrega, cambia o quita campos de cada elemento.',
    inputs: [''], outputs: [''],
    params: [
      { name: 'fields', label: 'Campos', type: 'fields', withType: true, default: [{ name: 'nuevoCampo', type: 'string', value: '' }] },
      { name: 'keepOnlySet', label: 'Conservar solo estos campos', type: 'boolean', default: false },
    ],
    run: async (ctx) => [ctx.items.map((item, i) => {
      const json = ctx.param('keepOnlySet', i) ? {} : structuredClone(item.json);
      (ctx.param('fields', i) || []).forEach((f) => { if (f.name) setPath(json, f.name, castValue(f.value, f.type)); });
      return { json };
    })],
  },
  code: {
    label: 'Código', group: 'Transformar datos', icon: '</>', color: '#ff9b26',
    description: 'Escriba JavaScript para transformar los datos como quiera.',
    inputs: [''], outputs: [''],
    params: [
      { name: 'mode', label: 'Modo', type: 'select', options: [['all', 'Una vez para todos los elementos'], ['each', 'Una vez por cada elemento']], default: 'all' },
      { name: 'jsCode', label: 'JavaScript', type: 'code', raw: true, rows: 12,
        default: '// items es la lista de entrada: [{ json: {...} }, ...]\n// Devuelva una lista de objetos o de { json }.\nreturn items.map(item => ({\n  ...item.json,\n  procesado: true,\n}));' },
    ],
    run: async (ctx) => {
      const mode = ctx.param('mode');
      const code = ctx.param('jsCode');
      const consoleProxy = { log: (...a) => ctx.log(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')) };
      // eslint-disable-next-line no-new-func
      const fn = new Function('items', '$input', '$json', '$index', 'console', `"use strict"; return (async () => {\n${code}\n})();`);
      const normalize = (r) => {
        if (r == null) return [];
        return (Array.isArray(r) ? r : [r]).map((x) => (x && typeof x === 'object' && 'json' in x && Object.keys(x).length <= 2 ? { json: x.json } : { json: x }));
      };
      const $input = { all: () => ctx.items, first: () => ctx.items[0] };
      if (mode === 'each') {
        const out = [];
        for (let i = 0; i < ctx.items.length; i++) out.push(...normalize(await fn(ctx.items, $input, ctx.items[i].json, i, consoleProxy)));
        return [out];
      }
      return [normalize(await fn(ctx.items, $input, ctx.items[0]?.json ?? {}, 0, consoleProxy))];
    },
  },
  splitOut: {
    label: 'Dividir en elementos', group: 'Transformar datos', icon: '⑃', color: '#5bc0de',
    description: 'Convierte una lista dentro de un campo en elementos separados.',
    inputs: [''], outputs: [''],
    params: [{ name: 'field', label: 'Campo con la lista', type: 'string', default: 'productos' }],
    run: async (ctx) => {
      const out = [];
      ctx.items.forEach((item, i) => {
        const field = ctx.param('field', i);
        const list = getPath(item.json, field);
        if (!Array.isArray(list)) throw new Error(`El campo «${field}» no es una lista en el elemento ${i}`);
        list.forEach((v) => out.push({ json: v && typeof v === 'object' ? v : { [field.split('.').pop()]: v } }));
      });
      return [out];
    },
  },
  sort: {
    label: 'Ordenar', group: 'Transformar datos', icon: '⇅', color: '#8e44ad',
    description: 'Ordena los elementos por un campo.',
    inputs: [''], outputs: [''],
    params: [
      { name: 'field', label: 'Campo', type: 'string', default: 'total' },
      { name: 'order', label: 'Orden', type: 'select', options: [['asc', 'Ascendente'], ['desc', 'Descendente']], default: 'asc' },
    ],
    run: async (ctx) => {
      const field = ctx.param('field');
      const dir = ctx.param('order') === 'desc' ? -1 : 1;
      const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true }));
      return [[...ctx.items].sort((a, b) => dir * cmp(getPath(a.json, field), getPath(b.json, field)))];
    },
  },
  limit: {
    label: 'Limitar', group: 'Transformar datos', icon: '⊟', color: '#95a5a6',
    description: 'Deja pasar solo cierta cantidad de elementos.',
    inputs: [''], outputs: [''],
    params: [
      { name: 'max', label: 'Máximo de elementos', type: 'number', default: 1 },
      { name: 'keep', label: 'Conservar', type: 'select', options: [['first', 'Los primeros'], ['last', 'Los últimos']], default: 'first' },
    ],
    run: async (ctx) => {
      const max = Number(ctx.param('max'));
      return [ctx.param('keep') === 'last' ? ctx.items.slice(-max) : ctx.items.slice(0, max)];
    },
  },
  summarize: {
    label: 'Resumir', group: 'Transformar datos', icon: 'Σ', color: '#16a085',
    description: 'Suma, cuenta o promedia un campo, con agrupación opcional.',
    inputs: [''], outputs: [''],
    params: [
      { name: 'operation', label: 'Operación', type: 'select', options: [['sum', 'Sumar'], ['count', 'Contar'], ['avg', 'Promedio'], ['min', 'Mínimo'], ['max', 'Máximo'], ['concat', 'Unir textos']], default: 'sum' },
      { name: 'field', label: 'Campo', type: 'string', default: 'total' },
      { name: 'groupBy', label: 'Agrupar por (opcional)', type: 'string', default: '' },
    ],
    run: async (ctx) => {
      const op = ctx.param('operation');
      const field = ctx.param('field');
      const groupBy = ctx.param('groupBy');
      const groups = new Map();
      ctx.items.forEach((it) => {
        const key = groupBy ? getPath(it.json, groupBy) : '__todo__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(getPath(it.json, field));
      });
      const outName = `${{ sum: 'suma', count: 'cantidad', avg: 'promedio', min: 'minimo', max: 'maximo', concat: 'unidos' }[op]}_${field}`;
      const calc = (vals) => {
        const nums = vals.map(Number).filter((n) => !Number.isNaN(n));
        switch (op) {
          case 'sum': return nums.reduce((a, b) => a + b, 0);
          case 'count': return vals.length;
          case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          case 'min': return Math.min(...nums);
          case 'max': return Math.max(...nums);
          case 'concat': return vals.join(', ');
          default: throw new Error(`Operación desconocida: ${op}`);
        }
      };
      return [[...groups].map(([key, vals]) => ({ json: { ...(groupBy ? { [groupBy]: key } : {}), [outName]: calc(vals) } }))];
    },
  },
  if: {
    label: 'Si (IF)', group: 'Lógica', icon: '⑂', color: '#408000',
    description: 'Envía cada elemento por «verdadero» o «falso» según una condición.',
    inputs: [''], outputs: ['verdadero', 'falso'],
    params: conditionParams,
    run: async (ctx) => {
      const yes = []; const no = [];
      ctx.items.forEach((item, i) => (testCondition(ctx, i) ? yes : no).push(item));
      return [yes, no];
    },
  },
  filter: {
    label: 'Filtrar', group: 'Lógica', icon: '⏚', color: '#229954',
    description: 'Deja pasar solo los elementos que cumplen la condición.',
    inputs: [''], outputs: [''],
    params: conditionParams,
    run: async (ctx) => [ctx.items.filter((_, i) => testCondition(ctx, i))],
  },
  merge: {
    label: 'Unir', group: 'Lógica', icon: '⋈', color: '#00bbbb',
    description: 'Junta los datos que llegan por dos entradas.',
    inputs: ['Entrada 1', 'Entrada 2'], outputs: [''],
    params: [
      { name: 'mode', label: 'Modo', type: 'select', options: [['append', 'Agregar uno tras otro'], ['position', 'Combinar por posición'], ['field', 'Combinar por campo']], default: 'append' },
      { name: 'field1', label: 'Campo en entrada 1', type: 'string', default: 'id', show: (p) => p.mode === 'field' },
      { name: 'field2', label: 'Campo en entrada 2', type: 'string', default: 'id', show: (p) => p.mode === 'field' },
    ],
    run: async (ctx) => {
      const [a = [], b = []] = ctx.inputs;
      const mode = ctx.param('mode');
      if (mode === 'append') return [[...a, ...b]];
      if (mode === 'position') return [Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({ json: { ...a[i]?.json, ...b[i]?.json } }))];
      const f1 = ctx.param('field1'); const f2 = ctx.param('field2');
      return [a.flatMap((x) => b.filter((y) => getPath(x.json, f1) == getPath(y.json, f2)).map((y) => ({ json: { ...x.json, ...y.json } })))]; // eslint-disable-line eqeqeq
    },
  },
  wait: {
    label: 'Esperar', group: 'Utilidades', icon: '⏳', color: '#e67e22',
    description: 'Hace una pausa antes de seguir.',
    inputs: [''], outputs: [''],
    params: [{ name: 'seconds', label: 'Segundos', type: 'number', default: 1 }],
    run: async (ctx) => { await sleep(Math.max(0, Number(ctx.param('seconds'))) * 1000); return [ctx.items]; },
  },
  noOp: {
    label: 'Sin operación', group: 'Utilidades', icon: '→', color: '#7f8c8d',
    description: 'No hace nada; sirve para ordenar el flujo o ver datos.',
    inputs: [''], outputs: [''], params: [],
    run: async (ctx) => [ctx.items],
  },
};

export const defaultParams = (type) =>
  Object.fromEntries(NODE_TYPES[type].params.map((p) => [p.name, structuredClone(p.default)]));
