import type {
  BloodDecal,
  BloodParticle,
  DustParticle,
  Gib,
  InputState,
  LevelConfig,
  Ragdoll,
  StickBone,
  VerletNode,
} from '../types/game';
import { nodeHitsSpike } from './collision';
import { BODY_NODES } from './body';
import { airAt, launchVelocity } from './aerodynamics';
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

function projectNodeX(node: VerletNode, x: number, preserveVelocity: boolean) {
  const correction=x-node.x;
  node.x=x;
  if(preserveVelocity) node.oldX+=correction;
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

  const nodes = BODY_NODES.map(n => makeNode(n.id, edgeX + dir * n.x, footY + n.y, n.radius, n.mass));

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
    diveAmount: 0,
    restPose: nodes.map(n => ({ x: n.x - comX, y: n.y - comY })),
    nodes,
    bones,
    alive: true,
    diving: false,
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
  const { vx, vy } = launchVelocity(angleRad, power, gravity);

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
  if (!ragdoll.alive) return { x: (ragdoll.nodes[2].x + ragdoll.nodes[3].x) / 2, y: (ragdoll.nodes[2].y + ragdoll.nodes[3].y) / 2 };
  const mass = ragdoll.nodes.reduce((sum,n) => sum+n.mass,0);
  return { x: ragdoll.nodes.reduce((sum,n) => sum+n.x*n.mass,0)/mass,
    y: ragdoll.nodes.reduce((sum,n) => sum+n.y*n.mass,0)/mass };
}

export function getRagdollSpeed(ragdoll: Ragdoll, dt: number): number {
  const subDt = ragdoll.previousSubDt ?? (dt || 1 / 60) / 3;
  const mass = ragdoll.nodes.reduce((sum,n) => sum+n.mass,0);
  const vx = ragdoll.nodes.reduce((sum,n) => sum+(n.x-n.oldX)*n.mass,0) / mass / subDt;
  const vy = ragdoll.nodes.reduce((sum,n) => sum+(n.y-n.oldY)*n.mass,0) / mass / subDt;
  return Math.hypot(vx,vy);
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
  // Air fields are spatial and deterministic; no clock-driven hazard motion.
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

  ragdoll.diving = ragdoll.alive && input.dive;

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
    const previousPositions=ragdoll.alive ? ragdoll.nodes.map(n=>({x:n.x,y:n.y})) : undefined;
    // 1. Controlled flight with pose-dependent aerodynamic drag; passive Verlet after impact.
    const dragX = Math.pow(0.986, subDt * 180);
    const dragY = Math.pow(0.9965, subDt * 180);

    if (ragdoll.alive) {
      stepControlledFlight(ragdoll, level.gravity, input.rotate ?? 0, subDt, level);
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

    if(ragdoll.alive) {
      const deckContact=ragdoll.nodes.filter(n=>(n.x<level.topLeftX||n.x>level.topRightX)&&n.oldY+n.radius<=level.platformY+6);
      const deckPenetration=Math.max(0,...deckContact.map(n=>n.y+n.radius-level.platformY));
      if(deckPenetration>0) {
        const mass=ragdoll.nodes.reduce((sum,n)=>sum+n.mass,0);
        const descending=ragdoll.nodes.reduce((sum,n)=>sum+(n.y-n.oldY)*n.mass,0)/mass>0;
        for(const n of ragdoll.nodes) {
          n.y-=deckPenetration; n.oldY-=deckPenetration;
          if(descending)n.oldY=n.y;
        }
      }
    }

    if (ragdoll.alive) {
      const penetration = Math.max(0,...ragdoll.nodes.map(n=>n.y+n.radius-level.floorY));
      if(penetration>0) {
        const speed=getRagdollSpeed(ragdoll,rawDt);
        // Resolve a living diver as one controlled body. Per-node floor
        // corrections used to deform the pose and create artificial rebounds.
        for(const n of ragdoll.nodes) {
          const vx=n.x-n.oldX;
          n.y-=penetration; n.oldY=n.y;
          n.oldX=n.x-vx*.65;
        }
        if(ragdoll.floorBounceCount===0 && speed>210) {
          soundEngine.playFloorImpact(Math.min(1,speed/900));
          for(let d=0;d<8;d++) gore.dust.push({x:getRagdollCenter(ragdoll).x+(Math.random()-.5)*20,
            y:level.floorY-2,vx:(Math.random()-.5)*100,vy:-20-Math.random()*60,
            radius:2+Math.random()*3,life:0,maxLife:.4});
        }
        ragdoll.floorBounceCount++;
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
          projectNodeX(n,n.radius,ragdoll.alive);
        }
        if (n.x + n.radius > level.worldWidth) {
          projectNodeX(n,level.worldWidth-n.radius,ragdoll.alive);
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
              projectNodeX(n,bounds.left+n.radius,ragdoll.alive);
            }
            if (n.x + n.radius > bounds.right) {
              projectNodeX(n,bounds.right-n.radius,ragdoll.alive);
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
                projectNodeX(n,level.topLeftX+n.radius,ragdoll.alive);
              }
            } else if (n.x > level.topRightX) {
              const overlapTop = n.y + n.radius - level.platformY;
              const overlapSide = n.x + n.radius - level.topRightX;
              if (overlapTop <= overlapSide) {
                n.y = level.platformY - n.radius;
                if (n.y - n.oldY > 0) n.oldY = n.y;
              } else {
                projectNodeX(n,level.topRightX-n.radius,ragdoll.alive);
              }
            }
          }
        }

        if (!ragdoll.alive && n.y + n.radius > level.floorY) {
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
        if (Math.max(n.y,previousPositions?.[i].y??n.y) + n.radius < sp.baseY1 - 4 || Math.min(n.y,previousPositions?.[i].y??n.y) - n.radius > sp.baseY2 + 4) {
          continue;
        }
        if (nodeHitsSpike(n, sp, previousPositions?.[i])) {
          sp.stained = 1;
          const nx = sp.side === 'left' ? 1 : -1;
          triggerFatalCollision(
            ragdoll,
            i,
            sp.tipX,
            sp.tipY,
            nx,
            -0.2,
            `${sp.side === 'left' ? 'Left' : 'Right'} wall · ${n.id === 'head' ? 'head' : i >= 8 ? 'leg' : i >= 4 ? 'arm' : 'torso'}${ragdoll.diving ? '' : ' · exposed'}`,
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
    const grounded = ragdoll.nodes.some(n=>n.y+n.radius>=level.floorY-.5);
    const safelyDown = grounded && ragdoll.nodes.every(n =>
      n.x - n.radius >= level.bottomLeftX && n.x + n.radius <= level.bottomRightX
    );
    ragdoll.landTimer = safelyDown ? ragdoll.landTimer + rawDt : 0;
  }

  // Step gore particles & decals
  stepGoreWorld(gore, level, rawDt, timeScale, elapsedTime);

  return { currentWind: airAt(level, getRagdollCenter(ragdoll).y).velocityX };
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
