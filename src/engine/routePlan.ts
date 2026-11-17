import type { FlightPlan } from '../types/game';

// Used to validate that a generated course has a human-operable route. The
// controls are the same digital dive/left/right inputs available in the game.
export function referenceInput(plan: FlightPlan, depth: number, angle: number, timingShift = 0) {
  const segment = plan.segments.find(s => depth >= s.from + timingShift && depth < s.to + timingShift);
  const target = segment?.angle ?? 0;
  const error = target - angle;
  return { dive: segment?.dive ?? true, rotate: Math.abs(error) < .035 ? 0 : Math.sign(error) };
}
