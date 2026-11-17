import type { Spike, VerletNode } from '../types/game';

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-6) return false;
  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function nodeHitsSpike(node: Pick<VerletNode,'x'|'y'|'radius'>, spike: Spike, previous?: {x:number;y:number}): boolean {
  const from=previous??node;
  const steps=Math.max(1,Math.ceil(Math.hypot(node.x-from.x,node.y-from.y)/Math.max(1,node.radius*.65)));
  const r=node.radius*.82;
  for(let i=0;i<=steps;i++) {
    const t=i/steps,x=from.x+(node.x-from.x)*t,y=from.y+(node.y-from.y)*t;
    if(pointInTriangle(x,y,spike.baseX1,spike.baseY1,spike.baseX2,spike.baseY2,spike.tipX,spike.tipY) ||
      distToSegment(x,y,spike.baseX1,spike.baseY1,spike.tipX,spike.tipY)<=r ||
      distToSegment(x,y,spike.baseX2,spike.baseY2,spike.tipX,spike.tipY)<=r) return true;
  }
  return false;
}
