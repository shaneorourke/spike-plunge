import type { LevelConfig } from '../types/game';

export interface AimSettings { elevation: number; power: number }
export const DEFAULT_AIM: AimSettings = { elevation: 55, power: .15 };
export function clampAim(aim: AimSettings): AimSettings {
  return { elevation: Math.max(13, Math.min(85, aim.elevation)),
    power: Math.max(.15, Math.min(1, aim.power)) };
}
export function launchAngle(level: LevelConfig, elevation: number): number {
  const angle = elevation * Math.PI / 180;
  return level.platformSide === 'left' ? -angle : -Math.PI + angle;
}
export function readAim(level: LevelConfig, angle: number, power: number): AimSettings {
  return { elevation: Math.round((level.platformSide === 'left' ? -angle : Math.PI + angle) * 180 / Math.PI * 100) / 100, power };
}
