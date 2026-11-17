import { MIN_POWER, MAX_POWER } from './aim';
import type { LevelConfig, WindZone } from '../types/game';

export interface Air { velocityX: number; velocityY: number; density: number }
export interface FlightMotion { x: number; y: number; vx: number; vy: number }
export const CALM_AIR: Air = { velocityX: 0, velocityY: 0, density: 1 };

// Spatially fixed airflow: waiting on the rim never changes a puzzle's outcome.
// Feathered boundaries avoid force discontinuities when entering a layer.
export function sampleAir(zones: readonly WindZone[], y: number): Air {
  let velocityX = 0, velocityY = 0, density = 1;
  for (const zone of zones) {
    if (y <= zone.yStart || y >= zone.yEnd) continue;
    const fade = Math.min(1, (y - zone.yStart) / 30, (zone.yEnd - y) / 30);
    const weight = fade * fade * (3 - 2 * fade);
    velocityX += zone.velocityX * weight;
    velocityY += zone.velocityY * weight;
    density += (zone.density - 1) * weight;
  }
  return { velocityX, velocityY, density };
}
export function airAt(level: LevelConfig | undefined, y: number): Air {
  return level ? sampleAir(level.windZones, y) : CALM_AIR;
}

export function projectedArea(angle: number, dive: number, vx: number, vy: number): number {
  const speed = Math.hypot(vx, vy);
  const broadside = speed > .001 ? Math.abs((vx * Math.cos(angle) + vy * Math.sin(angle)) / speed) : 0;
  const streamline = Math.max(0, Math.min(1, dive));
  const openArea = .55 + 1.15 * broadside;
  const diveArea = .28 + .65 * broadside;
  return openArea * (1-streamline) + diveArea * streamline;
}

export function advanceAirMotion(motion: FlightMotion, gravity: number, angle: number, dive: number, air: Air, dt: number): FlightMotion {
  const rx = motion.vx - air.velocityX, ry = motion.vy - air.velocityY;
  const speed = Math.hypot(rx, ry);
  const area = projectedArea(angle, dive, rx, ry);
  // Linear + speed-dependent drag, relative to the moving air. The implicit
  // damping step dissipates energy even at high speed instead of reversing it.
  const dragX = .35 + air.density * area * (1.7 + .001 * speed);
  const dragY = air.density * area * (.08 + .0018 * speed);
  const vx = air.velocityX + rx / (1 + dragX * dt);
  const vy = air.velocityY + ry / (1 + dragY * dt) + gravity * dt;
  return { x: motion.x + vx * dt, y: motion.y + vy * dt, vx, vy };
}

export function launchVelocity(angle: number, power: number, gravity = 820) {
  const speed = (180 + Math.max(MIN_POWER, Math.min(MAX_POWER, power)) * 420) * Math.sqrt(gravity / 820);
  return { vx: Math.cos(angle) * speed, vy: Math.min(-speed * .05, Math.sin(angle) * speed) };
}
