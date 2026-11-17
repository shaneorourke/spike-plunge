import { BODY_NODES } from './body';
import { advanceAirMotion, airAt } from './aerodynamics';
import type { LevelConfig, Ragdoll } from '../types/game';

export const MAX_TURN_SPEED = Math.PI / 3; // 60 degrees/sec, independent of tuck.
export const TUCK_SECONDS = .28;
const FOLDED = [
  [0, -17], [0, -8], [0, -2], [0, 8],
  [-9, -5], [-6, 3], [9, -5], [6, 3],
  [-9, 15], [-6, 8], [9, 15], [6, 8],
];

const BODY_MASS = BODY_NODES.reduce((sum,n) => sum+n.mass,0);
const FOLD_X = BODY_NODES.reduce((sum,n,i) => sum+FOLDED[i][0]*n.mass,0)/BODY_MASS;
const FOLD_Y = BODY_NODES.reduce((sum,n,i) => sum+FOLDED[i][1]*n.mass,0)/BODY_MASS;
export function poseOffset(rest: {x:number;y:number}, index: number, angle: number, tuck: number) {
  const blend = tuck*tuck*(3-2*tuck);
  const x = rest.x*(1-blend)+(FOLDED[index][0]-FOLD_X)*blend;
  const y = rest.y*(1-blend)+(FOLDED[index][1]-FOLD_Y)*blend;
  return {x:x*Math.cos(angle)-y*Math.sin(angle),y:x*Math.sin(angle)+y*Math.cos(angle)};
}

export interface FlightPose { bodyAngle: number; turnSpeed: number; tuckAmount: number }
export function advanceFlightPose(rag: FlightPose, tucking: boolean, turn: number, dt: number) {
  const targetSpeed = Math.max(-1, Math.min(1, turn)) * MAX_TURN_SPEED;
  rag.turnSpeed += Math.max(-4 * dt, Math.min(4 * dt, targetSpeed - rag.turnSpeed));
  if (turn === 0) rag.turnSpeed = 0;
  rag.bodyAngle += rag.turnSpeed * dt;
  const targetTuck = tucking ? 1 : 0;
  rag.tuckAmount += Math.max(-dt / TUCK_SECONDS, Math.min(dt / TUCK_SECONDS, targetTuck - rag.tuckAmount));
}

// Shape changes do not inject momentum; aerodynamic forces act at the mass
// centre. Orientation stays player controlled, even inside a strong crosswind.
export function stepControlledFlight(rag: Ragdoll, gravity: number, turn: number, dt: number, level?: LevelConfig) {
  const mass = rag.nodes.reduce((sum, n) => sum + n.mass, 0);
  let x = 0, y = 0, dx = 0, dy = 0;
  rag.nodes.forEach((n, i) => {
    x += n.x * n.mass; y += n.y * n.mass;
    dx += (n.x - n.oldX) * n.mass; dy += (n.y - n.oldY) * n.mass;
  });
  x /= mass; y /= mass;
  advanceFlightPose(rag, rag.tucking, turn, dt);
  const motion = advanceAirMotion({ x, y, vx: dx / mass / dt, vy: dy / mass / dt },
    gravity, rag.bodyAngle, rag.tuckAmount, airAt(level, y), dt);
  dx = motion.x - x; dy = motion.y - y;

  rag.nodes.forEach((n, i) => {
    const {x:rx,y:ry} = poseOffset(rag.restPose[i],i,rag.bodyAngle,rag.tuckAmount);
    n.x = x + dx + rx; n.y = y + dy + ry;
    n.oldX = n.x - dx + rag.turnSpeed * ry * dt;
    n.oldY = n.y - dy - rag.turnSpeed * rx * dt;
  });
}
