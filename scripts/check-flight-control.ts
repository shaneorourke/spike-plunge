import assert from 'node:assert/strict';
import { generateLevel } from '../src/engine/levelGen';
import { createRagdollOnPlatform, launchRagdoll } from '../src/engine/ragdoll';
import { MAX_TURN_SPEED, TUCK_SECONDS, stepControlledFlight } from '../src/engine/flightControl';

const level = generateLevel(1);
const make = () => {
  const rag = createRagdollOnPlatform(level);
  launchRagdoll(rag, -.7, .6, level.gravity, 1 / 180);
  return rag;
};
const centre = (rag: ReturnType<typeof make>) => {
  const mass = rag.nodes.reduce((s, n) => s + n.mass, 0);
  return {
    x: rag.nodes.reduce((s, n) => s + n.mass * n.x, 0) / mass,
    y: rag.nodes.reduce((s, n) => s + n.mass * n.y, 0) / mass,
  };
};
const neutral = make(), changingShape = make();
for (let step = 0; step < 720; step++) {
  changingShape.tucking = Math.floor(step / 60) % 2 === 0;
  stepControlledFlight(neutral, level.gravity, 0, 1 / 180);
  stepControlledFlight(changingShape, level.gravity, 0, 1 / 180);
  assert.equal(changingShape.bodyAngle, 0, 'Tuck must not rotate the body');
  assert.equal(changingShape.turnSpeed, 0, 'Neutral input must not inject spin');
  assert(Math.hypot(centre(neutral).x - centre(changingShape).x, centre(neutral).y - centre(changingShape).y) < 1e-7,
    'Tucking must preserve the trajectory');
}
for (const tuck of [false, true]) {
  for (const direction of [-1, 1]) {
    const rag = make();
    rag.tucking = tuck;
    for (let step = 0; step < 180; step++) {
      stepControlledFlight(rag, level.gravity, direction, 1 / 180);
      assert(Math.abs(rag.turnSpeed) <= MAX_TURN_SPEED + 1e-10);
    }
    assert(Math.sign(rag.bodyAngle) === direction, 'Rotation must follow the requested direction');
    assert(Math.abs(rag.bodyAngle) > .8 && Math.abs(rag.bodyAngle) < 1.05, 'One second turns roughly 50 degrees, not multiple spins');
    const held = rag.bodyAngle;
    for (let step = 0; step < 180; step++) stepControlledFlight(rag, level.gravity, 0, 1 / 180);
    assert.equal(rag.bodyAngle, held, 'Releasing rotation must hold the selected angle');
  }
}
const folding = make();
folding.tucking = true;
stepControlledFlight(folding, level.gravity, 0, 1 / 180);
assert(folding.tuckAmount > 0 && folding.tuckAmount < .03, 'Tuck must start gradually');
for (let step = 1; step < Math.ceil(TUCK_SECONDS * 180); step++) stepControlledFlight(folding, level.gravity, 0, 1 / 180);
assert.equal(folding.tuckAmount, 1, 'Tuck should complete within its documented transition');
console.log('Flight control passed: neutral stability, trajectory preservation, capped bidirectional rotation, angle hold, and smooth tuck.');
