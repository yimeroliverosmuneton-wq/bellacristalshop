// Expresiones al estilo n8n: cualquier texto con {{ ... }} se evalúa como JavaScript.
// Variables disponibles: $json, $index, $input, $now, $today, $('Nombre del nodo'), $workflow.

const SINGLE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
const ANY = /\{\{([\s\S]+?)\}\}/g;

export const isExpression = (v) => typeof v === 'string' && v.includes('{{');

function evalCode(code, scope) {
  const names = Object.keys(scope);
  try {
    // eslint-disable-next-line no-new-func
    return new Function(...names, `"use strict"; return (${code});`)(...names.map((n) => scope[n]));
  } catch (e) {
    throw new Error(`Expresión {{${code.trim()}}}: ${e.message}`);
  }
}

const toText = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function evaluate(value, scope) {
  if (!isExpression(value)) return value;
  const single = value.match(SINGLE);
  if (single && !single[1].includes('{{')) return evalCode(single[1], scope);
  return value.replace(ANY, (_, code) => toText(evalCode(code, scope)));
}

// Construye las variables de una expresión para el elemento `index` de `items`.
export function makeScope({ items = [], index = 0, results = {}, nodes = [], workflow }) {
  const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));
  const $ = (name) => {
    const node = byName[name];
    if (!node) throw new Error(`No existe el nodo «${name}»`);
    const res = results[node.id];
    if (!res || !res.output) throw new Error(`El nodo «${name}» aún no se ha ejecutado`);
    const all = res.output.flat();
    return {
      all: () => all,
      first: () => all[0],
      last: () => all[all.length - 1],
      get item() { return all[index] ?? all[0]; },
    };
  };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    $json: items[index]?.json ?? {},
    $index: index,
    $input: { all: () => items, first: () => items[0], last: () => items[items.length - 1], item: items[index] },
    $now: now,
    $today: today,
    $,
    $workflow: { id: workflow?.id, name: workflow?.name, active: !!workflow?.active },
  };
}

// Lee o escribe rutas con puntos: "cliente.nombre", "productos.0.precio".
export function getPath(obj, path) {
  if (!path) return obj;
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = String(path).split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  });
  o[keys[keys.length - 1]] = value;
  return obj;
}
