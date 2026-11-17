import type { LevelConfig, Spike } from '../types/game';

function getDifficultyLabel(level: number): string {
  if (level === 1) return 'Wide Funnel';
  if (level <= 3) return 'Narrowing V';
  if (level <= 6) return 'Steep Chute';
  if (level <= 10) return 'Tight Funnel';
  if (level <= 15) return 'Needle Eye';
  if (level <= 22) return 'Terminal V';
  return 'Razor Abyss';
}

export function getShaftBoundsAtY(
  level: LevelConfig,
  y: number
): { left: number; right: number; width: number } {
  const span = Math.max(1, level.floorY - level.platformY);
  const t = Math.max(0, Math.min(1, (y - level.platformY) / span));
  const left = level.topLeftX + t * (level.bottomLeftX - level.topLeftX);
  const right = level.topRightX + t * (level.bottomRightX - level.topRightX);
  return { left, right, width: right - left };
}

export function generateLevel(level: number): LevelConfig {
  const worldWidth = 420;
  const centerX = worldWidth * 0.5;

  // V-shaped shaft shape modification at level 15+:
  // Make top wider (smaller inset) and bottom narrower, with more headroom at launch area
  let topInset: number;
  let bottomWidth: number;
  let platformY = 140;

  if (level < 15) {
    topInset = Math.min(126, 84 + Math.floor((level - 1) * 2.5));
    bottomWidth = Math.max(70, 178 - (level - 1) * 7);
    platformY = 140;
  } else {
    topInset = Math.max(28, 62 - (level - 15) * 2);
    bottomWidth = Math.max(34, 56 - (level - 15) * 1.5);
    platformY = 175;
  }

  const topLeftX = topInset;
  const topRightX = worldWidth - topInset;

  const bottomLeftX = centerX - bottomWidth * 0.5;
  const bottomRightX = centerX + bottomWidth * 0.5;

  // Shaft grows infinitely longer per level
  const shaftHeight = 960 + (level - 1) * 210;
  const floorY = platformY + shaftHeight;

  const platformSide: 'left' | 'right' = level % 2 === 1 ? 'left' : 'right';
  const platformWidth = Math.max(58, 72 - Math.min(14, (level - 1) * 1.1));
  // Platform sits on the OUTSIDE rim of the top of the V (flush with topLeftX / topRightX)
  const platformX =
    platformSide === 'left' ? topLeftX - platformWidth : topRightX;

  const gravity = Math.min(1650, 820 + (level - 1) * 30);

  // Continuous spikes lining both sloped V-walls starting below the pit rim
  const wallSpikes: Spike[] = [];
  const spikePitch = 26;
  const spikeDepth = Math.min(18, 14 + Math.floor((level - 1) * 0.2));

  const leftStartY =
    platformSide === 'left' ? platformY + 14 : platformY + 6;
  const rightStartY =
    platformSide === 'right' ? platformY + 14 : platformY + 6;

  const sampleWallX = (y: number, side: 'left' | 'right'): number => {
    const t = Math.max(0, Math.min(1, (y - platformY) / shaftHeight));
    return side === 'left'
      ? topLeftX + t * (bottomLeftX - topLeftX)
      : topRightX + t * (bottomRightX - topRightX);
  };

  let spikeIdx = 0;
  // Left sloped wall spikes
  for (let y = leftStartY; y < floorY - spikePitch; y += spikePitch) {
    const y2 = y + spikePitch;
    const x1 = sampleWallX(y, 'left');
    const x2 = sampleWallX(y2, 'left');
    const midX = (x1 + x2) * 0.5;
    const midY = (y + y2) * 0.5;
    const dx = x2 - x1;
    const dy = y2 - y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;

    wallSpikes.push({
      id: `ws-l-${spikeIdx++}`,
      baseX1: x1,
      baseY1: y,
      baseX2: x2,
      baseY2: y2,
      tipX: midX + nx * spikeDepth,
      tipY: midY + ny * spikeDepth,
      side: 'left',
      stained: 0,
    });
  }

  // Right sloped wall spikes
  for (let y = rightStartY; y < floorY - spikePitch; y += spikePitch) {
    const y2 = y + spikePitch;
    const x1 = sampleWallX(y, 'right');
    const x2 = sampleWallX(y2, 'right');
    const midX = (x1 + x2) * 0.5;
    const midY = (y + y2) * 0.5;
    const dx = x2 - x1;
    const dy = y2 - y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    wallSpikes.push({
      id: `ws-r-${spikeIdx++}`,
      baseX1: x1,
      baseY1: y,
      baseX2: x2,
      baseY2: y2,
      tipX: midX + nx * spikeDepth,
      tipY: midY + ny * spikeDepth,
      side: 'right',
      stained: 0,
    });
  }

  return {
    level,
    worldWidth,
    topLeftX,
    topRightX,
    bottomLeftX,
    bottomRightX,
    shaftHeight,
    platformX,
    platformY,
    platformWidth,
    platformSide,
    floorY,
    gravity,
    wallSpikes,
    ledges: [],
    pistons: [],
    saws: [],
    windZones: [],
    difficultyLabel: getDifficultyLabel(level),
  };
}
