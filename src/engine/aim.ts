import type { LevelConfig } from '../types/game';

export interface AimSettings { elevation: number; power: number }
export const MIN_ELEVATION = 5;
export const MAX_ELEVATION = 89;
export const MIN_POWER = 0;
export const MAX_POWER = 1.5;
export const DEFAULT_AIM: AimSettings = { elevation: 89, power: 0 };
export function clampAim(aim: AimSettings): AimSettings {
  return { elevation: Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, aim.elevation)),
    power: Math.max(MIN_POWER, Math.min(MAX_POWER, aim.power)) };
}
export function launchAngle(level: LevelConfig, elevation: number): number {
  const angle = elevation * Math.PI / 180;
  return level.platformSide === 'left' ? -angle : -Math.PI + angle;
}
export function readAim(level: LevelConfig, angle: number, power: number): AimSettings {
  return { elevation: Math.round((level.platformSide === 'left' ? -angle : Math.PI + angle) * 180 / Math.PI * 100) / 100, power };
}
