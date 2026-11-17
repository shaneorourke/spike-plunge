import type {
  BloodDecal,
  BloodParticle,
  DustParticle,
  Gib,
  InputState,
  LevelConfig,
  Ragdoll,
  Spike,
  StickBone,
  VerletNode,
} from '../types/game';
import { stepControlledFlight } from './flightControl';
import { soundEngine } from './audio';
import { getShaftBoundsAtY } from './levelGen';

export interface GoreWorld {
  bloodParticles: BloodParticle[];
  bloodDecals: BloodDecal[];
  gibs: Gib[];
  dust: DustParticle[];
  shake: number;
  hitStop: number;
  flashAlpha: number;
}

export function createGoreWorld(): GoreWorld {
  return {
    bloodParticles: [],
    bloodDecals: [],
    gibs: [],
    dust: [],
    shake: 0,
    hitStop: 0,
    flashAlpha: 0,
  };
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function createRagdollOnPlatform(level: LevelConfig): Ragdoll {
  // Position stickman near the jumping edge of the platform
  const edgeX =
    level.platformSide === 'left'
      ? level.platformX + level.platformWidth - 16
      : level.platformX + 16;
  // Rest feet cleanly on top of the platform surface (node radius is 4)
  const footY = level.platformY - 4;
  const dir = level.platformSide === 'left' ? 1 : -1;

  const makeNode = (
    id: string,
    x: number,
    y: number,
    radius: number,
    mass = 1
  ): VerletNode => ({
    id,
    x,
    y,
    oldX: x,
    oldY: y,
    radius,
    mass,
    bloodCooldown: 0,
  });

  // 12-node articulated stickman
  const nodes: VerletNode[] = [
    makeNode('head', edgeX + dir * 2, footY - 54, 8.5, 1.1), // 0
    makeNode('neck', edgeX, footY - 43, 3.5, 0.9), // 1
    makeNode('chest', edgeX - dir * 1, footY - 33, 4.5, 1.3), // 2
    makeNode('pelvis', edgeX - dir * 2, footY - 21, 4.5, 1.3), // 3
    makeNode('elbowL', edgeX - dir * 8, footY - 36, 3, 0.6), // 4
    makeNode('handL', edgeX - dir * 4, footY - 26, 3.5, 0.5), // 5
    makeNode('elbowR', edgeX + dir * 9, footY - 36, 3, 0.6), // 6
    makeNode('handR', edgeX + dir * 14, footY - 28, 3.5, 0.5), // 7
    makeNode('kneeL', edgeX - dir * 5, footY - 10, 3.5, 0.7), // 8
    makeNode('footL', edgeX - dir * 6, footY, 4, 0.6), // 9
    makeNode('kneeR', edgeX + dir * 4, footY - 10, 3.5, 0.7), // 10
    makeNode('footR', edgeX + dir * 3, footY, 4, 0.6), // 11
  ];

  const makeBone = (
    id: string,
    a: number,
    b: number,
    thickness: number,
    stiffness = 1.0,
    severable = false,
    limbName?: string,
    isPostureSpring = false
  ): StickBone => ({
    id,
    a,
    b,
    length: dist(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y),
    thickness,
    stiffness,
    severable,
    severed: false,
    limbName,
    isPostureSpring,
  });

  const bones: StickBone[] = [
    makeBone('neck-head', 1, 0, 3, 1.0, true, 'Head'),
    makeBone('neck-chest', 1, 2, 4.5, 1.0, false),
    makeBone('chest-pelvis', 2, 3, 4.5, 1.0, true, 'Torso'),
    makeBone('upperArmL', 1, 4, 3.2, 0.95, true, 'Left Arm'),
    makeBone('foreArmL', 4, 5, 2.8, 0.95, true, 'Left Hand'),
    makeBone('upperArmR', 1, 6, 3.2, 0.95, true, 'Right Arm'),
    makeBone('foreArmR', 6, 7, 2.8, 0.95, true, 'Right Hand'),
    makeBone('thighL', 3, 8, 3.8, 0.95, true, 'Left Leg'),
    makeBone('shinL', 8, 9, 3.2, 0.95, true, 'Left Foot'),
    makeBone('thighR', 3, 10, 3.8, 0.95, true, 'Right Leg'),
    makeBone('shinR', 10, 11, 3.2, 0.95, true, 'Right Foot'),
    // Soft structural posture springs so ragdoll keeps human shape instead of collapsing flat
    makeBone('spine-brace', 0, 3, 0, 0.25, false, undefined, true),
    makeBone('hip-braceL', 2, 8, 0, 0.14, false, undefined, true),
    makeBone('hip-braceR', 2, 10, 0, 0.14, false, undefined, true),
    makeBone('arm-brace', 4, 6, 0, 0.07, false, undefined, true),
    makeBone('knee-brace', 8, 10, 0, 0.09, false, undefined, true),
  ];

  const mass = nodes.reduce((sum, n) => sum + n.mass, 0);
  const comX = nodes.reduce((sum, n) => sum + n.mass * n.x, 0) / mass;
  const comY = nodes.reduce((sum, n) => sum + n.mass * n.y, 0) / mass;
  return {
    bodyAngle: 0,
    turnSpeed: 0,
    tuckAmount: 0,
    restPose: nodes.map(n => ({ x: n.x - comX, y: n.y - comY })),
    nodes,
    bones,
    alive: true,
    tucking: false,
    limbsLost: 0,
    fatalCause: null,
    deathTime: 0,
    landTimer: 0,
    maxSpeed: 0,
    floorBounceCount: 0,
  };
}

export function launchRagdoll(
  ragdoll: Ragdoll,
  angleRad: number,
  power: number,
  gravity: number,
  dt: number,
  gore?: GoreWorld
): void {
  // Scale launch speed with sqrt(gravity) so jump arc height & reach stay consistent across levels
  const gravityScale = Math.sqrt(Math.max(1, gravity) / 820);
  const clampedPower = Math.max(0.15, Math.min(1, power));
  const speed = (180 + clampedPower * 420) * gravityScale;

  // Enforce upward-only launch (sin <= -0.22) so character always jumps up off the platform
  const vx = Math.cos(angleRad) * speed;
  const vy = Math.min(-speed * 0.22, Math.sin(angleRad) * speed);
  // Launch adds translation only. Rotation is entirely player controlled.
  for (const n of ragdoll.nodes) {
    n.oldX = n.x - vx * dt;
    n.oldY = n.y - vy * dt;
  }
  ragdoll.turnSpeed = 0;

  ragdoll.previousSubDt = dt;

  // Spawn takeoff dust puff from feet on platform
  if (gore) {
    const fL = ragdoll.nodes[9];
    const fR = ragdoll.nodes[11];
    for (let d = 0; d < 8; d++) {
      const origin = d % 2 === 0 ? fL : fR;
      gore.dust.push({
        x: origin.x + (Math.random() - 0.5) * 10,
        y: origin.y + origin.radius - 1,
        vx: -vx * 0.18 + (Math.random() - 0.5) * 95,
        vy: -15 - Math.random() * 65,
        radius: 2.5 + Math.random() * 4,
        life: 0,
        maxLife: 0.32 + Math.random() * 0.22,
      });
    }
  }
}

export function getRagdollCenter(ragdoll: Ragdoll): { x: number; y: number } {
  // Follow torso/chest if intact, else pelvis/head
  const chest = ragdoll.nodes[2];
  const pelvis = ragdoll.nodes[3];
  return {
    x: (chest.x + pelvis.x) * 0.5,
    y: (chest.y + pelvis.y) * 0.5,
  };
}

export function getRagdollSpeed(ragdoll: Ragdoll, dt: number): number {
  const chest = ragdoll.nodes[2];
  const subDt = (dt || 1 / 60) / 3;
  const vx = (chest.x - chest.oldX) / subDt;
  const vy = (chest.y - chest.oldY) / subDt;
  return Math.hypot(vx, vy);
}

function pointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
): boolean {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-6) return false;
  const invDenom = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
  return u >= 0 && v >= 0 && u + v <= 1;
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function nodeHitsSpike(node: VerletNode, spike: Spike): boolean {
  const ax = spike.baseX1;
  const ay = spike.baseY1;
  const bx = spike.baseX2;
  const by = spike.baseY2;
  const cx = spike.tipX;
  const cy = spike.tipY;

  if (pointInTriangle(node.x, node.y, ax, ay, bx, by, cx, cy)) {
    return true;
  }
  const r = node.radius * 0.82;
  if (distToSegment(node.x, node.y, ax, ay, cx, cy) <= r) return true;
  if (distToSegment(node.x, node.y, bx, by, cx, cy) <= r) return true;
  return false;
}

const BLOOD_PALETTE = ['#DC2626', '#B91C1C', '#991B1B', '#EF4444', '#7F1D1D'];

function spawnBloodBurst(
  gore: GoreWorld,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  count: number,
  power: number,
  level: LevelConfig
): void {
  for (let i = 0; i < count; i++) {
    const spread = (Math.random() - 0.5) * 2.4;
    const baseAngle = Math.atan2(dirY, dirX) + spread;
    const spd = (80 + Math.random() * 280) * power;
    gore.bloodParticles.push({
      x,
      y,
      vx: Math.cos(baseAngle) * spd,
      vy: Math.sin(baseAngle) * spd - 40,
      radius: 1.6 + Math.random() * 3.4,
      life: 0,
      maxLife: 0.55 + Math.random() * 0.75,
      color: BLOOD_PALETTE[Math.floor(Math.random() * BLOOD_PALETTE.length)],
    });
  }

  // Paint permanent wall/bg splatter near impact
  const splatterCount = Math.min(8, Math.floor(count / 4));
  for (let i = 0; i < splatterCount; i++) {
    const ox = (Math.random() - 0.5) * 44;
    const oy = (Math.random() - 0.5) * 44;
    const sy = Math.min(level.floorY - 2, y + oy);
    const bounds = getShaftBoundsAtY(level, sy);
    const sx = Math.max(
      bounds.left - 4,
      Math.min(bounds.right + 4, x + ox)
    );
    gore.bloodDecals.push({
      x: sx,
      y: sy,
      radius: 4 + Math.random() * 11,
      alpha: 0.65 + Math.random() * 0.3,
      color: BLOOD_PALETTE[Math.floor(Math.random() * 3)],
      dripLength: 8 + Math.random() * 32,
      dripProgress: 0,
    });
  }

  if (gore.bloodDecals.length > 260) {
    gore.bloodDecals.splice(0, gore.bloodDecals.length - 260);
  }
}

function spawnGibs(
  gore: GoreWorld,
  x: number,
  y: number,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 90 + Math.random() * 240;
    gore.gibs.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 80,
      angle: Math.random() * Math.PI * 2,
      vAngle: (Math.random() - 0.5) * 18,
      size: 2.5 + Math.random() * 4,
      kind: Math.random() < 0.35 ? 'bone' : 'flesh',
      life: 2.4,
    });
  }
}

function triggerFatalCollision(
  ragdoll: Ragdoll,
  nodeIdx: number,
  impactX: number,
  impactY: number,
  normalX: number,
  normalY: number,
  cause: string,
  level: LevelConfig,
  gore: GoreWorld,
  dt: number
): void {
  const node = ragdoll.nodes[nodeIdx];
  const vx = (node.x - node.oldX) / dt;
  const vy = (node.y - node.oldY) / dt;
  const impactSpeed = Math.hypot(vx, vy);

  const wasAlive = ragdoll.alive;
  if (wasAlive) {
    ragdoll.alive = false;
    ragdoll.fatalCause = cause;
    ragdoll.impactDepth = Math.max(0, (impactY - level.platformY) / 10);
    gore.hitStop = 0.045;
    gore.flashAlpha = 0.42;
    gore.shake = Math.min(18, 9 + impactSpeed * 0.012);
    soundEngine.playSpikeHit(Math.min(1.2, 0.7 + impactSpeed / 700));
  } else if (node.bloodCooldown <= 0) {
    gore.shake = Math.max(gore.shake, 5);
    soundEngine.playSpikeHit(0.45);
  }

  if (node.bloodCooldown <= 0) {
    node.bloodCooldown = 0.14;
    spawnBloodBurst(
      gore,
      impactX,
      impactY,
      normalX,
      normalY,
      wasAlive ? 34 : 14,
      wasAlive ? 1.15 : 0.7,
      level
    );
  }

  // Sever attached bones on violent hits
  if (impactSpeed > 180 || wasAlive) {
    for (const bone of ragdoll.bones) {
      if (bone.severable && !bone.severed && !bone.isPostureSpring) {
        if (bone.a === nodeIdx || bone.b === nodeIdx) {
          // Always sever extremities or high speed torso/neck
          if (nodeIdx === 0 || nodeIdx >= 4 || impactSpeed > 320) {
            bone.severed = true;
            ragdoll.limbsLost += 1;
            spawnGibs(gore, node.x, node.y, wasAlive ? 6 : 3);
            break;
          }
        }
      }
    }
  }

  // Rebound slightly off spike so ragdoll tumbles viscerally instead of vanishing
  const bounceVx = vx * -0.35 + normalX * 120;
  const bounceVy = vy * 0.45 + normalY * 70;
  node.oldX = node.x - bounceVx * dt;
  node.oldY = node.y - bounceVy * dt;
}

export function stepHazards(_level: LevelConfig, _elapsedTime: number): void {
  // No mid-shaft moving obstacles; pure V-shaped spike chute
}

export function stepRagdollAndGore(
  ragdoll: Ragdoll,
  level: LevelConfig,
  input: InputState,
  gore: GoreWorld,
  rawDt: number,
  elapsedTime: number
): { currentWind: number } {
  // Handle impact hit-stop freeze frame
  if (gore.hitStop > 0) {
    gore.hitStop = Math.max(0, gore.hitStop - rawDt);
    gore.shake = Math.max(0, gore.shake - rawDt * 25);
    return { currentWind: 0 };
  }

  // Slow-motion death cam
  const timeScale = ragdoll.alive ? 1.0 : 0.36;
  const dt = rawDt * timeScale;
  if (!ragdoll.alive) {
    ragdoll.deathTime += rawDt;
  }

  ragdoll.tucking = ragdoll.alive && input.tuck;

  const subSteps = 3;
  const subDt = dt / subSteps;

  // Verlet stores displacement, so changing time scale must also rescale it.
  const previousSubDt = ragdoll.previousSubDt ?? subDt;
  const timeRatio = subDt / previousSubDt;
  for (const n of ragdoll.nodes) {
    n.oldX = n.x - (n.x - n.oldX) * timeRatio;
    n.oldY = n.y - (n.y - n.oldY) * timeRatio;
  }
  ragdoll.previousSubDt = subDt;

  for (let step = 0; step < subSteps; step++) {
    // 1. Verlet integration + forces (tuck does NOT alter drag or gravity — pure limb avoidance)
    const dragX = Math.pow(0.986, subDt * 180);
    const dragY = Math.pow(0.9965, subDt * 180);

    if (ragdoll.alive) {
      stepControlledFlight(ragdoll, level.gravity, input.rotate ?? 0, subDt);
    }
    for (let i = 0; i < ragdoll.nodes.length; i++) {
      const n = ragdoll.nodes[i];
      if (n.bloodCooldown > 0) {
        n.bloodCooldown = Math.max(0, n.bloodCooldown - subDt);
      }

      if (ragdoll.alive) continue;
      const vx = (n.x - n.oldX) * dragX;
      const vy = (n.y - n.oldY) * dragY;

      n.oldX = n.x;
      n.oldY = n.y;

      const ay = level.gravity;

      n.x += vx;
      n.y += vy + ay * subDt * subDt;

      // Continuous blood spray from severed nodes
      if (!ragdoll.alive && n.bloodCooldown <= 0) {
        const hasSevered = ragdoll.bones.some(
          (b) => b.severed && (b.a === i || b.b === i)
        );
        if (hasSevered && Math.random() < 0.25) {
          gore.bloodParticles.push({
            x: n.x,
            y: n.y,
            vx: vx / subDt * 0.4 + (Math.random() - 0.5) * 60,
            vy: vy / subDt * 0.4 + (Math.random() - 0.5) * 60,
            radius: 1.5 + Math.random() * 2,
            life: 0,
            maxLife: 0.45 + Math.random() * 0.35,
            color: '#DC2626',
          });
        }
      }
    }

    // Living poses are already solved. Passive constraints are only for death.
    const iterations = ragdoll.alive ? 1 : 7;
    for (let it = 0; it < iterations; it++) {
      if (!ragdoll.alive) for (const bone of ragdoll.bones) {
        if (bone.severed || bone.isPostureSpring) continue;
        const a = ragdoll.nodes[bone.a], b = ragdoll.nodes[bone.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || .0001;
        const correction = (length - bone.length) / length * bone.stiffness;
        const mass = a.mass + b.mass;
        a.x += dx * correction * b.mass / mass;
        a.y += dy * correction * b.mass / mass;
        b.x -= dx * correction * a.mass / mass;
        b.y -= dy * correction * a.mass / mass;
      }

      // 3. Solid boundary collisions inside solver (open sky above rim, outer cliff decks, V-shaped shaft walls)
      for (const n of ragdoll.nodes) {
        if (n.x - n.radius < 0) {
          n.x = n.radius;
        }
        if (n.x + n.radius > level.worldWidth) {
          n.x = level.worldWidth - n.radius;
        }
        if (n.y - n.radius < -180) {
          n.y = -180 + n.radius;
        }

        // Solid outer cliffs (0..topLeftX and topRightX..worldWidth) + sloped V-shaft walls below platformY
        if (n.y + n.radius > level.platformY) {
          const bounds = getShaftBoundsAtY(level, n.y);
          const cameFromAbove = n.oldY + n.radius <= level.platformY + 6;

          if (
            cameFromAbove &&
            (n.x < level.topLeftX || n.x > level.topRightX)
          ) {
            // Landed on top of the outer cliff / launch platform
            n.y = level.platformY - n.radius;
            const vx = n.x - n.oldX;
            n.oldX = n.x - vx * 0.85;
            if (n.y - n.oldY > 0) {
              n.oldY = n.y;
            }
          } else if (n.y >= level.platformY) {
            // Inside the V-shaped shaft below the rim
            if (n.x - n.radius < bounds.left) {
              n.x = bounds.left + n.radius;
            }
            if (n.x + n.radius > bounds.right) {
              n.x = bounds.right - n.radius;
            }
          } else {
            // Grazing right at the pit corner (platformY - radius < y < platformY)
            if (n.x < level.topLeftX) {
              const overlapTop = n.y + n.radius - level.platformY;
              const overlapSide = level.topLeftX - (n.x - n.radius);
              if (overlapTop <= overlapSide) {
                n.y = level.platformY - n.radius;
                if (n.y - n.oldY > 0) n.oldY = n.y;
              } else {
                n.x = level.topLeftX + n.radius;
              }
            } else if (n.x > level.topRightX) {
              const overlapTop = n.y + n.radius - level.platformY;
              const overlapSide = n.x + n.radius - level.topRightX;
              if (overlapTop <= overlapSide) {
                n.y = level.platformY - n.radius;
                if (n.y - n.oldY > 0) n.oldY = n.y;
              } else {
                n.x = level.topRightX - n.radius;
              }
            }
          }
        }

        if (n.y + n.radius > level.floorY) {
          const vy = (n.y - n.oldY) / subDt;
          n.y = level.floorY - n.radius;
          // Floor impact dust & sound on heavy slam
          if (vy > 210 && it === 0) {
            ragdoll.floorBounceCount += 1;
            const intensity = Math.min(1, vy / 900);
            if (ragdoll.floorBounceCount <= 3) {
              soundEngine.playFloorImpact(intensity);
            }
            for (let d = 0; d < 6; d++) {
              gore.dust.push({
                x: n.x + (Math.random() - 0.5) * 16,
                y: level.floorY - 2,
                vx: (Math.random() - 0.5) * 140,
                vy: -20 - Math.random() * 80 * intensity,
                radius: 3 + Math.random() * 5,
                life: 0,
                maxLife: 0.35 + Math.random() * 0.25,
              });
            }
            // Add bounce + floor friction
            const vx = n.x - n.oldX;
            n.oldX = n.x - vx * 0.72;
            n.oldY = n.y + (n.y - n.oldY) * 0.18;
          } else if (it === 0) {
            const vx = n.x - n.oldX;
            n.oldX = n.x - vx * 0.76;
          }
        }
      }
    }

    // 4. Hazard & Spike Collisions (only lethal before touching the landing zone)
    if (ragdoll.landTimer < 0.15) {
      for (let i = 0; i < ragdoll.nodes.length; i++) {
        const n = ragdoll.nodes[i];

      // Wall Spikes (broadphase Y filter for performance)
      for (const sp of level.wallSpikes) {
        if (n.y + n.radius < sp.baseY1 - 4 || n.y - n.radius > sp.baseY2 + 4) {
          continue;
        }
        if (nodeHitsSpike(n, sp)) {
          sp.stained = 1;
          const nx = sp.side === 'left' ? 1 : -1;
          triggerFatalCollision(
            ragdoll,
            i,
            sp.tipX,
            sp.tipY,
            nx,
            -0.2,
            `${sp.side === 'left' ? 'Left' : 'Right'} wall · ${n.id === 'head' ? 'head' : i >= 8 ? 'leg' : i >= 4 ? 'arm' : 'torso'}${ragdoll.tucking ? '' : ' · untucked'}`,
            level,
            gore,
            subDt
          );
          break;
        }
      }
    }
    }
  }

  // Track max fall speed (convert logical px/s to km/h-like display scale)
  const spd = getRagdollSpeed(ragdoll, dt || 0.016);
  const kmh = spd * 0.14;
  if (kmh > ragdoll.maxSpeed) {
    ragdoll.maxSpeed = kmh;
  }

  // A foot grazing the floor is not a clear. The torso must arrive alive,
  // and all body nodes must remain within the landing pad during confirmation.
  if (ragdoll.alive) {
    const core = getRagdollCenter(ragdoll);
    const safelyDown = core.y >= level.floorY - 32 && ragdoll.nodes.every(n =>
      n.x - n.radius >= level.bottomLeftX && n.x + n.radius <= level.bottomRightX
    );
    ragdoll.landTimer = safelyDown ? ragdoll.landTimer + rawDt : 0;
  }

  // Step gore particles & decals
  stepGoreWorld(gore, level, rawDt, timeScale, elapsedTime);

  return { currentWind: 0 };
}

function stepGoreWorld(
  gore: GoreWorld,
  level: LevelConfig,
  rawDt: number,
  timeScale: number,
  _elapsedTime: number
): void {
  const dt = rawDt * timeScale;
  gore.shake = Math.max(0, gore.shake - rawDt * 28);
  gore.flashAlpha = Math.max(0, gore.flashAlpha - rawDt * 1.8);

  for (let i = gore.bloodParticles.length - 1; i >= 0; i--) {
    const p = gore.bloodParticles[i];
    p.life += dt;
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const bounds = getShaftBoundsAtY(level, p.y);
    // Leave floor/wall decals when particles hit surfaces
    if (p.x <= bounds.left + 2 || p.x >= bounds.right - 2 || p.y >= level.floorY - 1) {
      const clampedX = Math.max(bounds.left, Math.min(bounds.right, p.x));
      const clampedY = Math.min(level.floorY - 1, p.y);
      if (Math.random() < 0.45 && gore.bloodDecals.length < 260) {
        gore.bloodDecals.push({
          x: clampedX,
          y: clampedY,
          radius: p.radius * (1.2 + Math.random() * 1.4),
          alpha: 0.75,
          color: p.color,
          dripLength: p.y >= level.floorY - 4 ? 0 : 10 + Math.random() * 24,
          dripProgress: 0,
        });
      }
      gore.bloodParticles.splice(i, 1);
      continue;
    }

    if (p.life >= p.maxLife) {
      gore.bloodParticles.splice(i, 1);
    }
  }

  for (const decal of gore.bloodDecals) {
    if (decal.dripProgress < decal.dripLength) {
      decal.dripProgress = Math.min(
        decal.dripLength,
        decal.dripProgress + rawDt * 18
      );
    }
  }

  for (let i = gore.gibs.length - 1; i >= 0; i--) {
    const g = gore.gibs[i];
    g.life -= rawDt;
    g.vy += 880 * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.angle += g.vAngle * dt;

    const bounds = getShaftBoundsAtY(level, g.y);
    if (g.x < bounds.left + g.size) {
      g.x = bounds.left + g.size;
      g.vx = Math.abs(g.vx) * 0.45;
    } else if (g.x > bounds.right - g.size) {
      g.x = bounds.right - g.size;
      g.vx = -Math.abs(g.vx) * 0.45;
    }
    if (g.y > level.floorY - g.size) {
      g.y = level.floorY - g.size;
      g.vy = -Math.abs(g.vy) * 0.35;
      g.vx *= 0.7;
      g.vAngle *= 0.6;
    }
    if (g.life <= 0) {
      gore.gibs.splice(i, 1);
    }
  }

  for (let i = gore.dust.length - 1; i >= 0; i--) {
    const d = gore.dust[i];
    d.life += rawDt;
    d.x += d.vx * rawDt;
    d.y += d.vy * rawDt;
    d.vx *= 0.94;
    d.vy *= 0.94;
    if (d.life >= d.maxLife) {
      gore.dust.splice(i, 1);
    }
  }
}
