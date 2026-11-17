import type { FlightPlan, LevelConfig, ShaftPoint, Spike, WindZone } from '../types/game';
import { advanceAirMotion, launchVelocity, sampleAir, type FlightMotion } from './aerodynamics';
import { BODY_NODES, launchOrigin } from './body';
import { advanceFlightPose, poseOffset } from './flightControl';
import { referenceInput } from './routePlan';

const FAMILIES = [
  { name: 'First Principles', tip: 'Tuck is streamlined. Opening your body adds drag; turning broadside adds more.' },
  { name: 'Crosswind', tip: 'Air carries you sideways. Tuck to cut through it; open your body to catch more of it.' },
  { name: 'Airbrake Chamber', tip: 'Open and turn across the airflow in the wide chamber. Fold back in before the next pinch.' },
  { name: 'Updraft Well', tip: 'The rising air slows your descent. Use that extra time to control your angle and drift.' },
  { name: 'Downburst', tip: 'Descending air shortens your reaction time. Plan the tuck before entering the fast layer.' },
  { name: 'Dense Air', tip: 'The amber layer increases drag. A compact body keeps more momentum through it.' },
  { name: 'Wind Reversal', tip: 'Two opposing air streams. Catch one, shed the other; the order matters.' },
  { name: 'Dogleg', tip: 'The shaft bends with the airflow. Think about where your momentum will carry you after the wind ends.' },
  { name: 'Pressure Lock', tip: 'A dense chamber between two throats. Use the chamber to change shape and heading.' },
  { name: 'Broken Rhythm', tip: 'The gaps are unevenly spaced. Read the whole survey before choosing your launch.' },
  { name: 'Countercurrent', tip: 'Horizontal and rising air overlap. Body angle changes both descent time and how much wind you catch.' },
  { name: 'Confluence', tip: 'Several air layers, one landing. Make each pose change a deliberate part of the route.' },
];

function randomSource(stage: number) {
  let seed = (Math.imul(stage ^ 0x51f15e, 0x45d9f3b) ^ 0x9e3779b9) >>> 0;
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}

export function boundsOnProfile(points: readonly ShaftPoint[], y: number) {
  if (y <= points[0].y) return { ...points[0], width: points[0].right - points[0].left };
  for (let i = 1; i < points.length; i++) {
    if (y > points[i].y) continue;
    const a = points[i - 1], b = points[i];
    const t = (y - a.y) / (b.y - a.y);
    const left = a.left + t * (b.left - a.left), right = a.right + t * (b.right - a.right);
    return { left, right, width: right - left };
  }
  const end = points[points.length - 1];
  return { ...end, width: end.right - end.left };
}
export function getShaftBoundsAtY(level: LevelConfig, y: number) { return boundsOnProfile(level.profile, y); }

interface RoutePoint extends FlightMotion { bodyAngle:number; tuckAmount:number }

function traceRoute(plan: FlightPlan, zones: WindZone[], origin: { x: number; y: number }, height: number, platformY: number, side: 'left' | 'right') {
  const angle = side === 'left' ? -plan.elevation * Math.PI / 180 : -Math.PI + plan.elevation * Math.PI / 180;
  let motion: FlightMotion = { ...origin, ...launchVelocity(angle, plan.power) };
  const pose = { bodyAngle: 0, turnSpeed: 0, tuckAmount: 0 };
  const points: RoutePoint[] = [];
  for (let frame = 0; frame < 900 && motion.y < platformY + height; frame++) {
    const input = referenceInput(plan, (motion.y - platformY) / height, pose.bodyAngle);
    for (let sub = 0; sub < 3; sub++) {
      advanceFlightPose(pose, input.tuck, input.rotate, 1 / 180);
      motion = advanceAirMotion(motion, 820, pose.bodyAngle, pose.tuckAmount, sampleAir(zones, motion.y), 1 / 180);
      if (motion.vy > 0 && motion.y >= platformY) points.push({...motion, bodyAngle:pose.bodyAngle, tuckAmount:pose.tuckAmount});
    }
  }
  return points;
}

function makeSpikes(profile: ShaftPoint[], platformY: number, floorY: number, depth: number): Spike[] {
  const spikes: Spike[] = [];
  for (const side of ['left', 'right'] as const) {
    // End each triangle at profile vertices: collision teeth match the drawn walls.
    for (let part = 1; part < profile.length; part++) {
      const start = Math.max(platformY + 18, profile[part - 1].y);
      const end = Math.min(floorY - 28, profile[part].y);
      const count = Math.max(1, Math.ceil((end - start) / 26));
      for (let i = 0; i < count && end > start; i++) {
        const y1 = start + (end - start) * i / count, y2 = start + (end - start) * (i + 1) / count;
        const x1 = boundsOnProfile(profile, y1)[side], x2 = boundsOnProfile(profile, y2)[side];
        const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
        const sign = side === 'left' ? 1 : -1;
        spikes.push({ id: `${side}-${part}-${i}`, baseX1: x1, baseY1: y1, baseX2: x2, baseY2: y2,
          tipX: (x1 + x2) / 2 + sign * dy / length * depth,
          tipY: (y1 + y2) / 2 - sign * dx / length * depth, side, stained: 0 });
      }
    }
  }
  return spikes;
}

function buildLevel(level: number): LevelConfig {
  const rand = randomSource(level);
  const familyIndex = level <= 12 ? level - 1 : Math.floor(rand() * FAMILIES.length);
  const family = FAMILIES[familyIndex];
  const challenge = 1 - Math.exp(-(level - 1) / 28);
  const shaftHeight = Math.round(820 + challenge * 330 + rand() * (level === 1 ? 0 : 260));
  const platformY = 140, floorY = platformY + shaftHeight;
  const topLeftX = 72, topRightX = 348;
  const platformSide = level <= 4 ? (level % 2 ? 'left' : 'right') : rand() < .5 ? 'left' : 'right';
  const direction = platformSide === 'left' ? 1 : -1;
  const windDirection = rand() < .5 ? -1 : 1;
  const zones: WindZone[] = [];
  const zone = (from: number, to: number, vx: number, vy: number, density: number, label: string) => zones.push({
    id: `air-${zones.length}`, yStart: platformY + from * shaftHeight, yEnd: platformY + to * shaftHeight,
    velocityX: vx, velocityY: vy, density, label,
  });
  const strength = 65 + challenge * 35 + rand() * 25;
  if (familyIndex === 1) zone(.25, .70, windDirection * strength, 0, 1, 'Crosswind');
  if (familyIndex === 2) zone(.27, .57, windDirection * (strength + 25), 0, 1.2, 'Brake chamber');
  if (familyIndex === 3) zone(.28, .72, windDirection * 35, -150, 1, 'Updraft');
  if (familyIndex === 4) zone(.32, .73, windDirection * 25, 170, 1, 'Downburst');
  if (familyIndex === 5) zone(.25, .66, windDirection * 30, 0, 2.1, 'Dense air');
  if (familyIndex === 6 || familyIndex === 7) {
    zone(.23, .47, windDirection * (strength + 20), 0, 1, 'Crosswind');
    zone(.54, .81, -windDirection * strength, 0, 1, 'Reversal');
  }
  if (familyIndex === 8) zone(.30, .61, windDirection * 55, -70, 2, 'Pressure lock');
  if (familyIndex === 9) zone(.43, .72, windDirection * strength, 80, 1, 'Late current');
  if (familyIndex === 10) zone(.24, .77, windDirection * strength, -130, 1.4, 'Countercurrent');
  if (familyIndex === 11) {
    zone(.22, .45, windDirection * strength, -90, 1.2, 'Rising crosswind');
    zone(.52, .80, -windDirection * strength, 100, 1.6, 'Descending reversal');
  }
  // Later stages combine a main chamber with an independently chosen exit
  // condition. The same named family need not call for the same final approach.
  let exitTip = '';
  if (level > 12) {
    const modifier = Math.floor(rand() * 5);
    if (modifier === 1) { zone(.79,.95,windDirection*40,-110,1,'Lift pocket'); exitTip=' A rising pocket changes the final approach.'; }
    if (modifier === 2) { zone(.79,.95,-windDirection*45,130,1,'Drop chute'); exitTip=' A descending exit current gives you less time at the final gate.'; }
    if (modifier === 3) { zone(.75,.95,0,0,.45,'Thin air'); exitTip=' Thin air near the exit gives your momentum more carry.'; }
    if (modifier === 4) { zone(.73,.94,-windDirection*85,0,1.3,'Late drift'); exitTip=' A final crosswind pushes against the earlier stream.'; }
  }
  const reference: FlightPlan = { elevation: 32 + rand() * 15, power: .6, segments: [] };
  if (familyIndex >= 2 && familyIndex !== 4) {
    reference.segments.push({ from: .14 + rand() * .025, to: .54 + rand() * .025, tuck: false, angle: direction * (50 + rand() * 15) * Math.PI / 180 });
  }
  if (familyIndex === 6 || familyIndex === 11) reference.segments.push({ from: .59, to: .72, tuck: false, angle: -direction * Math.PI / 8 });
  const origin = launchOrigin(topLeftX, topRightX, platformY, platformSide);
  const targetX = 210 + (rand() - .5) * 38;
  let low = .22, high = .96;
  let trace: RoutePoint[] = [];
  // Solve launch reach before shaping the corridor. This is deterministic
  // construction, not a runtime search over collisions or a player auto-solver.
  for(let attempt=0;attempt<10;attempt++) {
    low=.22; high=.96;
    for (let i = 0; i < 11; i++) {
      reference.power = (low + high) / 2;
      trace = traceRoute(reference, zones, origin, shaftHeight, platformY, platformSide);
      const endX = trace[trace.length - 1].x;
      if ((endX - targetX) * direction > 0) high = reference.power; else low = reference.power;
    }
    if(trace.every(p=>p.x>=76&&p.x<=344)) break;
    // Very unusual seeds may place the route too near the outside world edge.
    // Reduce the currents, then construct again, rather than clipping the body.
    zones.forEach(z=>{z.velocityX*=attempt>=7 ? 0 : .75;z.velocityY*=attempt>=7 ? 0 : .9;});
  }
  const atDepth = (t: number) => {
    const y = platformY + t * shaftHeight;
    const b = trace.find(p => p.y >= y) ?? trace[trace.length - 1];
    return b.x;
  };
  const gateWidth = 108 - challenge * 24;
  const gatePatterns = [
    [.74], [.30,.81], [.22,.68], [.25,.61,.87], [.57,.85], [.29,.73],
    [.21,.51,.86], [.39,.80], [.24,.75], [.23,.42,.70,.90], [.21,.85], [.21,.51,.86],
  ];
  const samples = [{ t: 0, width: 276 }, { t: .12, width: 228 }];
  for (const position of gatePatterns[familyIndex]) {
    const t = position + (rand() - .5) * .045;
    const broad = 166 + rand() * 55;
    if (t - .065 > .145) samples.push({ t: t - .065, width: broad });
    samples.push({ t, width: gateWidth + rand() * 10 });
    if (t + .065 < .96) samples.push({ t: t + .065, width: broad + (rand() - .5) * 20 });
  }
  samples.push({ t: 1, width: 106 + rand() * 18 });
  samples.sort((a,b) => a.t - b.t);
  const profile: ShaftPoint[] = samples.map(({ t, width }, i) => {
    if (i === 0) return { y: platformY, left: topLeftX, right: topRightX };
    const x = atDepth(t);
    const safeWidth = Math.min(width, 2 * Math.min(x - 12, 408 - x));
    return { y: platformY + t * shaftHeight, left: x - safeWidth / 2, right: x + safeWidth / 2 };
  });
  // Reserve clearance around the actual shared body pose throughout the
  // reference flight, including the radii and sloped-wall spike projection.
  // This construction guard applies to every seed, not only sampled tests.
  const bodyMass=BODY_NODES.reduce((sum,n)=>sum+n.mass,0);
  const restX=BODY_NODES.reduce((sum,n)=>sum+n.x*n.mass,0)/bodyMass;
  const restY=BODY_NODES.reduce((sum,n)=>sum+n.y*n.mass,0)/bodyMass;
  const spikeDepth=12+challenge*2;
  for(let pass=0;pass<3;pass++) for(const sample of trace) for(let n=0;n<BODY_NODES.length;n++) {
    const node=BODY_NODES[n];
    const offset=poseOffset({x:direction*(node.x-restX),y:node.y-restY},n,sample.bodyAngle,sample.tuckAmount);
    const x=sample.x+offset.x,y=sample.y+offset.y;
    if(y<=platformY||y>=floorY-28) continue;
    const index=profile.findIndex((p,i)=>i>0&&p.y>=y);
    if(index<1) continue;
    const a=profile[index-1],b=profile[index],t=(y-a.y)/(b.y-a.y);
    for(const side of ['left','right'] as const) {
      const slope=(b[side]-a[side])/(b.y-a.y);
      const reserve=(spikeDepth+node.radius+3)*Math.hypot(1,slope);
      const wall=a[side]*(1-t)+b[side]*t;
      const missing=side==='left' ? wall-(x-reserve) : (x+reserve)-wall;
      if(missing<=0) continue;
      const shift=(side==='left'?-1:1)*(missing+.05);
      if(index===1) b[side]+=shift/Math.max(.01,t);
      else {a[side]+=shift;b[side]+=shift;}
      a[side]=Math.max(0,Math.min(420,a[side])); b[side]=Math.max(0,Math.min(420,b[side]));
    }
  }
  const bottom = profile[profile.length - 1];
  const seed = (Math.imul(level, 2654435761) >>> 0).toString(36).toUpperCase().padStart(7, '0');
  return {
    level, seed, family: family.name, reference,
    profile, briefing: family.tip + exitTip, tier: level <= 4 ? 'BRUTAL' : level <= 16 ? 'RELENTLESS' : 'EXPERT',
    difficultyLabel: `${family.name} · ${seed.slice(-3)}`,
    worldWidth: 420, topLeftX, topRightX, bottomLeftX: bottom.left, bottomRightX: bottom.right,
    platformY, platformWidth: 64, platformX: platformSide === 'left' ? topLeftX - 64 : topRightX,
    platformSide, shaftHeight, floorY, gravity: 820,
    wallSpikes: makeSpikes(profile, platformY, floorY, spikeDepth),
    ledges: [], pistons: [], saws: [], windZones: zones,
  };
}

const cache = new Map<number, LevelConfig>();
export function generateLevel(stage: number): LevelConfig {
  const level = Math.max(1, Math.min(2147483647, Math.floor(Number.isFinite(stage) ? stage : 1)));
  let base = cache.get(level);
  if (!base) {
    base = buildLevel(level);
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(level, base);
  }
  return { ...base, profile: base.profile.map(p => ({ ...p })), windZones: base.windZones.map(z => ({ ...z })),
    reference: { ...base.reference, segments: base.reference.segments.map(s => ({ ...s })) },
    wallSpikes: base.wallSpikes.map(s => ({ ...s })) };
}
