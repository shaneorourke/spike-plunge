import type { LevelConfig, Spike } from '../types/game';

const ROUTES = [
  { name: 'Initiation', shift: 0, throat: 112, at: .74, exit: 128, depth: 0,
    tip: 'Find the centre. Tuck before the walls close in.' },
  { name: 'Early Squeeze', shift: 10, throat: 102, at: .40, exit: 138, depth: 80,
    tip: 'The first pinch arrives early. Commit to your tuck on entry.' },
  { name: 'Left of Centre', shift: -22, throat: 100, at: .68, exit: 116, depth: 120,
    tip: 'The landing is offset left. Aim for the passage, not the screen centre.' },
  { name: 'Hourglass', shift: 0, throat: 94, at: .53, exit: 140, depth: 160,
    tip: 'A narrow waist opens into a wider landing. Stay compact through the waist.' },
  { name: 'Right of Passage', shift: 24, throat: 96, at: .72, exit: 112, depth: 140,
    tip: 'A right-shifted exit rewards a carefully measured launch.' },
  { name: 'Double Bind', shift: -10, throat: 92, at: .42, exit: 114, depth: 220,
    tip: 'Two constrictions. Getting past the first is only half the dive.' },
  { name: 'Late Commitment', shift: 14, throat: 90, at: .84, exit: 100, depth: 260,
    tip: 'A long approach hides a tight finish. Small aim changes matter.' },
  { name: 'The Crucible', shift: 0, throat: 90, at: .63, exit: 104, depth: 300,
    tip: 'The final exam: a narrow throat and little room for an untucked limb.' },
];

export function getShaftBoundsAtY(level: LevelConfig, y: number) {
  const points = level.profile;
  const end = points[points.length - 1];
  if (y <= points[0].y) return { ...points[0], width: points[0].right - points[0].left };
  for (let i = 1; i < points.length; i++) {
    if (y > points[i].y) continue;
    const a = points[i - 1], b = points[i];
    const t = (y - a.y) / (b.y - a.y);
    const left = a.left + t * (b.left - a.left);
    const right = a.right + t * (b.right - a.right);
    return { left, right, width: right - left };
  }
  return { ...end, width: end.right - end.left };
}

export function generateLevel(level: number): LevelConfig {
  level = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const route = ROUTES[(level - 1) % ROUTES.length];
  // Teach a pattern, then revisit it with a little less clearance. Difficulty
  // approaches a ceiling: no infinitely long shafts or body-width exits.
  const challenge = 1 - Math.exp(-(level - 1) / 24);
  const worldWidth = 420;
  const centerX = 210 + route.shift;
  const platformY = 140;
  const topInset = 72 + challenge * 10;
  const bottomWidth = route.exit - challenge * 22;
  const topLeftX = topInset;
  const topRightX = worldWidth - topInset;
  const bottomLeftX = centerX - bottomWidth * 0.5;
  const bottomRightX = centerX + bottomWidth * 0.5;
  const shaftHeight = 760 + challenge * 280 + route.depth;
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

  const throatWidth = route.throat - challenge * 18;
  const point = (t: number, center: number, width: number) => ({
    y: platformY + shaftHeight * t, left: center - width / 2, right: center + width / 2,
  });
  const profile = [
    point(0, 210, topRightX - topLeftX),
    point(.17, 210, 244),
    point(route.at - .10, centerX, throatWidth + 36),
    point(route.at, centerX, throatWidth),
    point(Math.min(.94, route.at + .10), centerX, throatWidth + 30),
    point(1, centerX, bottomWidth),
  ];
  if ((level - 1) % ROUTES.length === 5) {
    profile.splice(5, 0, point(.77, centerX + 4, throatWidth));
  }
  const sampleWallX = (y: number, side: 'left' | 'right'): number => {
    const end = profile[profile.length - 1];
    for (let i = 1; i < profile.length; i++) {
      if (y > profile[i].y) continue;
      const a = profile[i - 1], b = profile[i];
      const t = Math.max(0, (y - a.y) / (b.y - a.y));
      return a[side] + t * (b[side] - a[side]);
    }
    return end[side];
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
    profile,
    briefing: route.tip,
    tier: level <= 8 ? 'BRUTAL' : level <= 24 ? 'RELENTLESS' : 'EXPERT',
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
    difficultyLabel: `${route.name}${level > 8 ? ` · ${Math.floor((level - 1) / 8) + 1}` : ''}`,
  };
}
