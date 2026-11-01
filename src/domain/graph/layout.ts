export type GNode = { id: string };
export type GEdge = { a: string; b: string };
export type Placed = Record<string, { x: number; y: number }>;

/**
 * A small force-directed layout (repulsion between all nodes, springs along edges). Deterministic: nodes start on a circle
 * in input order, so the same data always draws the same picture. O(n²) per step, fine for a personal address book.
 */
export function layout(nodes: GNode[], edges: GEdge[], w: number, h: number, steps = 220): Placed {
  const n = nodes.length;
  const pos = nodes.map((_, i) => ({
    x: w / 2 + (Math.cos((2 * Math.PI * i) / n) * w) / 3,
    y: h / 2 + (Math.sin((2 * Math.PI * i) / n) * h) / 3,
    dx: 0,
    dy: 0,
  }));
  const index = new Map(nodes.map((nd, i) => [nd.id, i]));
  const k = Math.sqrt((w * h) / Math.max(n, 1)) * 0.7;
  for (let s = 0; s < steps; s++) {
    const cool = 1 - s / steps;
    for (const p of pos) { p.dx = 0; p.dy = 0; }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x || 0.01;
        const dy = pos[i].y - pos[j].y || 0.01;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        pos[i].dx += (dx / d) * f; pos[i].dy += (dy / d) * f;
        pos[j].dx -= (dx / d) * f; pos[j].dy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const i = index.get(e.a); const j = index.get(e.b);
      if (i === undefined || j === undefined) continue;
      const dx = pos[i].x - pos[j].x; const dy = pos[i].y - pos[j].y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      pos[i].dx -= (dx / d) * f; pos[i].dy -= (dy / d) * f;
      pos[j].dx += (dx / d) * f; pos[j].dy += (dy / d) * f;
    }
    for (const p of pos) {
      const d = Math.hypot(p.dx, p.dy) || 0.01;
      const step = Math.min(d, 30 * cool + 1);
      p.x = Math.min(w - 36, Math.max(36, p.x + (p.dx / d) * step));
      p.y = Math.min(h - 36, Math.max(36, p.y + (p.dy / d) * step));
    }
  }
  return Object.fromEntries(nodes.map((nd, i) => [nd.id, { x: pos[i].x, y: pos[i].y }]));
}
