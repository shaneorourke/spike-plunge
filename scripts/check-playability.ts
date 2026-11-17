import assert from 'node:assert/strict';
import { generateLevel } from '../src/engine/levelGen';
import { createGoreWorld, createRagdollOnPlatform, launchRagdoll, stepRagdollAndGore } from '../src/engine/ragdoll';
// Audio is silent in the headless simulation; gameplay uses the real solver.
(globalThis as any).window = {};
for (const stage of [...Array.from({length: 30}, (_, i) => i + 1), 60, 100, 1000]) {
  for (const tuck of [false, true]) {
  const defaultLevel = generateLevel(stage);
  const defaultRag = createRagdollOnPlatform(defaultLevel);
  const defaultGore = createGoreWorld();
  const defaultAngle = defaultLevel.platformSide === 'left' ? -Math.PI * .6 : -Math.PI * .4;
  launchRagdoll(defaultRag, defaultAngle, .45, defaultLevel.gravity, 1/180);
  for (let frame = 0; frame < 900 && defaultRag.alive && defaultRag.landTimer < .15; frame++) {
    stepRagdollAndGore(defaultRag, defaultLevel, {
      tuck, aimActive: false, aimAngle: defaultAngle, aimPower: .45,
    }, defaultGore, 1/60, frame/60);
  }
  assert(defaultRag.landTimer < .15, `Stage ${stage} must require deliberate aiming`);
  }
  let wins = 0;
  for (let degrees = 25; degrees <= 80; degrees += 5) {
    for (let power = .2; power <= 1.001; power += .1) {
      const level = generateLevel(stage);
      const rag = createRagdollOnPlatform(level);
      const gore = createGoreWorld();
      const angle = level.platformSide === 'left' ? -degrees * Math.PI / 180 : -Math.PI + degrees * Math.PI / 180;
      launchRagdoll(rag, angle, power, level.gravity, 1/180);
      for (let frame = 0; frame < 900 && rag.alive && rag.landTimer < .15; frame++) {
        stepRagdollAndGore(rag, level, {tuck: true, aimActive: false, aimAngle: angle, aimPower: power}, gore, 1/60, frame/60);
      }
      if (rag.alive && rag.landTimer >= .15) wins++;
    }
  }
  console.log(`Stage ${stage}: ${wins} successful launches / 108`);
  assert(wins >= 3, `Stage ${stage} needs multiple achievable launches`);
}
