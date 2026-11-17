import assert from 'node:assert/strict';
import { DEFAULT_AIM, launchAngle } from '../src/engine/aim';
import { generateLevel } from '../src/engine/levelGen';
import { createGoreWorld, createRagdollOnPlatform, launchRagdoll, stepRagdollAndGore } from '../src/engine/ragdoll';

// Audio is silent in headless mode; every shot uses the production solver.
(globalThis as any).window = {};
function dive(stage: number, degrees: number, power: number, tuck = true) {
  const level = generateLevel(stage);
  const rag = createRagdollOnPlatform(level);
  const gore = createGoreWorld();
  const angle = launchAngle(level, degrees);
  launchRagdoll(rag, angle, power, level.gravity, 1 / 180);
  for (let frame = 0; frame < 900 && rag.alive && rag.landTimer < .15; frame++) {
    stepRagdollAndGore(rag, level, { tuck, aimActive: false, aimAngle: angle, aimPower: power }, gore, 1 / 60, frame / 60);
  }
  assert(rag.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)), 'Simulation must remain finite');
  return rag.alive && rag.landTimer >= .15;
}

// Every early stage and each route at the difficulty ceiling. A coarse search
// must find a solution with a usable local tolerance, not a single exact shot.
for (const stage of [...Array.from({ length: 64 }, (_, i) => i + 1), ...Array.from({ length: 8 }, (_, i) => 993 + i)]) {
  for (const tuck of [false, true]) {
    assert(!dive(stage, DEFAULT_AIM.elevation, DEFAULT_AIM.power, tuck), `Stage ${stage} must require aiming`);
  }
  let wins = 0;
  let robust = false;
  const winners: [number, number][] = [];
  for (let degrees = 25; degrees <= 80; degrees += 5) {
    for (let step = 2; step <= 10; step++) {
      const power = step / 10;
      if (!dive(stage, degrees, power)) continue;
      wins++;
      winners.push([degrees, power]);
      if (!robust) {
        robust = [-.5, 0, .5].every(delta => [-.005, 0, .005].every(dp => dive(stage, degrees + delta, power + dp)));
      }
    }
  }
  // Refine only when the coarse grid lands on the edge of a valid window.
  for (const [degrees, power] of winners) {
    if (robust) break;
    for (const delta of [-2.5, 2.5]) {
      for (const dp of [-.04, -.02, 0, .02, .04]) {
        if (robust) break;
        robust = [-.5, 0, .5].every(d => [-.005, 0, .005].every(p => dive(stage, degrees + delta + d, power + dp + p)));
      }
    }
  }
  console.log(`Stage ${stage}: ${wins}/108 coarse launches clear; forgiving local route: ${robust}`);
  assert(wins >= 1 && robust, `Stage ${stage} needs a clear route with aim tolerance`);
}

// A foot reaching the floor cannot grant immunity to the rest of the body.
const level = generateLevel(1);
const rag = createRagdollOnPlatform(level);
rag.nodes[9].y = level.floorY - 4;
rag.nodes[9].oldY = rag.nodes[9].y;
stepRagdollAndGore(rag, level, { tuck: false, aimActive: false, aimAngle: 0, aimPower: .15 }, createGoreWorld(), 1 / 60, 0);
assert.equal(rag.landTimer, 0, 'An isolated foot contact is not a landing');
assert.deepEqual(generateLevel(8), generateLevel(8), 'Retry geometry must be deterministic');
console.log('Floor-contact and deterministic-generation regressions passed.');
