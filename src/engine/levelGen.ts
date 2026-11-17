import type { LevelConfig, Spike } from '../types/game';

const ROUTES = [
  { name: 'First Flight', shift: 0, width: 0, depth: 0 },
  { name: 'Long Glide', shift: 12, width: 12, depth: 140 },
  { name: 'Precision Drop', shift: -10, width: -8, depth: 30 },
  { name: 'Offset Canyon', shift: 22, width: 10, depth: 200 },
  { name: 'Needle Practice', shift: 0, width: -16, depth: 80 },
  { name: 'Endurance Plunge', shift: -18, width: 6, depth: 300 },
];

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
  level = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const route = ROUTES[(level - 1) % ROUTES.length];
  // Teach a pattern, then revisit it with a little less clearance. Difficulty
  // approaches a ceiling: no infinitely long shafts or body-width exits.
  const challenge = 1 - Math.exp(-(level - 1) / 18);
  const worldWidth = 420;
  const centerX = 210 + route.shift * Math.min(1, (level - 1) / 6);
  const platformY = 140;
  const topInset = 72 + challenge * 10;
  const bottomWidth = 150 - challenge * 54 + route.width;
  const topLeftX = topInset;
  const topRightX = worldWidth - topInset;
  const bottomLeftX = centerX - bottomWidth * 0.5;
  const bottomRightX = centerX + bottomWidth * 0.5;
  const shaftHeight = 780 + challenge * 520 + route.depth;
  const floorY = platformY + shaftHeight;

  const platformSide: 'left' | 'right' = level % 2 === 1 ? 'left' : 'right';
  const platformWidth = Math.max(58, 72 - Math.min(14, (level - 1) * 1.1));
  // Platform sits on the OUTSIDE rim of the top of the V (flush with topLeftX / topRightX)
  const platformX =
    platformSide === 'left' ? topLeftX - platformWidth : topRightX;

  const gravity = 820;

  // Continuous spikes lining both sloped V-walls starting below the pit rim
  const wallSpikes: Spike[] = [];
  const spikePitch = 26;
  const spikeDepth = 12 + challenge * 3;

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
    difficultyLabel: `${route.name}${level > 6 ? ` · ${Math.floor((level - 1) / 6) + 1}` : ''}`,
  };
}
