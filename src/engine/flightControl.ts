import { BODY_NODES } from './body';
import { advanceAirMotion, airAt } from './aerodynamics';
import type { LevelConfig, Ragdoll } from '../types/game';

export const MAX_TURN_SPEED = Math.PI / 3; // 60 degrees/sec, independent of dive.
export const DIVE_SECONDS = .28;
// Hands lead the head, arms extend, and the legs come together. The player
// chooses the dive's direction with rotation; entering it never adds a flip.
const DIVE_POSE = [
  [0, -25], [0, -15], [0, -5], [0, 8],
  [-4, -27], [-2, -36], [4, -27], [2, -36],
  [-2, 20], [-2, 31], [2, 20], [2, 31],
];

const BODY_MASS = BODY_NODES.reduce((sum,n) => sum+n.mass,0);
const DIVE_X = BODY_NODES.reduce((sum,n,i) => sum+DIVE_POSE[i][0]*n.mass,0)/BODY_MASS;
const DIVE_Y = BODY_NODES.reduce((sum,n,i) => sum+DIVE_POSE[i][1]*n.mass,0)/BODY_MASS;
export function poseOffset(rest: {x:number;y:number}, index: number, angle: number, dive: number) {
  const blend = dive*dive*(3-2*dive);
  const x = rest.x*(1-blend)+(DIVE_POSE[index][0]-DIVE_X)*blend;
  const y = rest.y*(1-blend)+(DIVE_POSE[index][1]-DIVE_Y)*blend;
  return {x:x*Math.cos(angle)-y*Math.sin(angle),y:x*Math.sin(angle)+y*Math.cos(angle)};
}

export interface FlightPose { bodyAngle: number; turnSpeed: number; diveAmount: number }
export function advanceFlightPose(rag: FlightPose, diving: boolean, turn: number, dt: number) {
  const targetSpeed = Math.max(-1, Math.min(1, turn)) * MAX_TURN_SPEED;
  rag.turnSpeed += Math.max(-4 * dt, Math.min(4 * dt, targetSpeed - rag.turnSpeed));
  if (turn === 0) rag.turnSpeed = 0;
  rag.bodyAngle += rag.turnSpeed * dt;
  const targetDive = diving ? 1 : 0;
  rag.diveAmount += Math.max(-dt / DIVE_SECONDS, Math.min(dt / DIVE_SECONDS, targetDive - rag.diveAmount));
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
  advanceFlightPose(rag, rag.diving, turn, dt);
  const motion = advanceAirMotion({ x, y, vx: dx / mass / dt, vy: dy / mass / dt },
    gravity, rag.bodyAngle, rag.diveAmount, airAt(level, y), dt);
  dx = motion.x - x; dy = motion.y - y;

  rag.nodes.forEach((n, i) => {
    const {x:rx,y:ry} = poseOffset(rag.restPose[i],i,rag.bodyAngle,rag.diveAmount);
    n.x = x + dx + rx; n.y = y + dy + ry;
    n.oldX = n.x - dx + rag.turnSpeed * ry * dt;
    n.oldY = n.y - dy - rag.turnSpeed * rx * dt;
  });
}
