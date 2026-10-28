import { NODE_TYPES } from './nodes.js';

export const NODE_W = 100;
export const NODE_H = 100;
export const GRID = 20;

export const snap = (v) => Math.round(v / GRID) * GRID;

const spread = (count, i) => (NODE_H * (i + 1)) / (count + 1);

export function handlePos(node, kind, index) {
  const def = NODE_TYPES[node.type];
  const count = kind === 'in' ? def.inputs.length : def.outputs.length;
  return { x: node.x + (kind === 'in' ? 0 : NODE_W), y: node.y + spread(count, index) };
}

export function edgePath(a, b) {
  const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
