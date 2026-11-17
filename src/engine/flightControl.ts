import type { Ragdoll } from '../types/game';

export const MAX_TURN_SPEED = Math.PI / 3; // 60 degrees/sec, independent of tuck.
export const TUCK_SECONDS = .28;
const FOLDED = [
  [0, -17], [0, -8], [0, -2], [0, 8],
  [-9, -5], [-6, 3], [9, -5], [6, 3],
  [-9, 15], [-6, 8], [9, 15], [6, 8],
];

// A living diver has an actively held pose. Changing shape must not inject
// momentum into a Verlet solver. Full passive ragdoll physics starts on impact.
export function stepControlledFlight(rag: Ragdoll, gravity: number, turn: number, dt: number) {
  const mass = rag.nodes.reduce((sum, n) => sum + n.mass, 0);
  let x = 0, y = 0, dx = 0, dy = 0, foldX = 0, foldY = 0;
  rag.nodes.forEach((n, i) => {
    x += n.x * n.mass; y += n.y * n.mass;
    dx += (n.x - n.oldX) * n.mass; dy += (n.y - n.oldY) * n.mass;
    foldX += FOLDED[i][0] * n.mass; foldY += FOLDED[i][1] * n.mass;
  });
  x /= mass; y /= mass;
  dx = dx / mass * Math.pow(.986, dt * 180);
  dy = dy / mass * Math.pow(.9965, dt * 180) + gravity * dt * dt;
  foldX /= mass; foldY /= mass;

  const targetSpeed = Math.max(-1, Math.min(1, turn)) * MAX_TURN_SPEED;
  const speedChange = Math.max(-4 * dt, Math.min(4 * dt, targetSpeed - rag.turnSpeed));
  rag.turnSpeed += speedChange;
  // Releasing rotation brakes immediately and holds the chosen angle.
  if (turn === 0) rag.turnSpeed = 0;
  rag.bodyAngle += rag.turnSpeed * dt;
  const targetTuck = rag.tucking ? 1 : 0;
  rag.tuckAmount += Math.max(-dt / TUCK_SECONDS, Math.min(dt / TUCK_SECONDS, targetTuck - rag.tuckAmount));
  const blend = rag.tuckAmount * rag.tuckAmount * (3 - 2 * rag.tuckAmount);
  const c = Math.cos(rag.bodyAngle), s = Math.sin(rag.bodyAngle);
  rag.nodes.forEach((n, i) => {
    const localX = rag.restPose[i].x * (1 - blend) + (FOLDED[i][0] - foldX) * blend;
    const localY = rag.restPose[i].y * (1 - blend) + (FOLDED[i][1] - foldY) * blend;
    const rx = localX * c - localY * s, ry = localX * s + localY * c;
    n.x = x + dx + rx; n.y = y + dy + ry;
    n.oldX = n.x - dx + rag.turnSpeed * ry * dt;
    n.oldY = n.y - dy - rag.turnSpeed * rx * dt;
  });
}
