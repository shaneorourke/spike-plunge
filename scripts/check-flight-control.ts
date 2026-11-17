import assert from 'node:assert/strict';
import { nodeHitsSpike } from '../src/engine/collision';
import { advanceAirMotion, CALM_AIR, projectedArea, sampleAir } from '../src/engine/aerodynamics';
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
const vacuum = generateLevel(1);
vacuum.windZones = [{id:'vacuum', yStart:-1e6, yEnd:1e6, velocityX:0, velocityY:0, density:0, label:'Test vacuum'}];
for (let step = 0; step < 720; step++) {
  changingShape.tucking = Math.floor(step / 60) % 2 === 0;
  stepControlledFlight(neutral, level.gravity, 0, 1 / 180, vacuum);
  stepControlledFlight(changingShape, level.gravity, 0, 1 / 180, vacuum);
  assert.equal(changingShape.bodyAngle, 0, 'Tuck must not rotate the body');
  assert.equal(changingShape.turnSpeed, 0, 'Neutral input must not inject spin');
  assert(Math.hypot(centre(neutral).x - centre(changingShape).x, centre(neutral).y - centre(changingShape).y) < 1e-7,
    'Changing shape must not inject momentum in zero-density air');
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
// Air acts on relative velocity: energy decays without gravity and body area
// determines drag. It must never add uncontrolled angular motion.
const air = {velocityX:90,velocityY:-120,density:1.4};
let motion = {x:0,y:0,vx:350,vy:600};
let previousEnergy = (motion.vx-air.velocityX)**2+(motion.vy-air.velocityY)**2;
for(let i=0;i<720;i++) {
  motion=advanceAirMotion(motion,0,.8,.3,air,1/180);
  const energy=(motion.vx-air.velocityX)**2+(motion.vy-air.velocityY)**2;
  assert(energy<=previousEnergy+1e-8,'Drag must dissipate air-relative energy'); previousEnergy=energy;
}
const drop = (angle:number,tuck:number,environment=CALM_AIR,dt=1/180) => {
  let state={x:0,y:0,vx:0,vy:0};
  for(let t=0;t<2-1e-8;t+=dt) state=advanceAirMotion(state,820,angle,tuck,environment,dt);
  return state;
};
const broad=drop(Math.PI/2,0), compact=drop(0,1), vertical=drop(0,0);
assert(compact.y>vertical.y && vertical.y>broad.y,'Tuck should fall fastest; broadside should brake hardest');
assert(drop(0,1,air).x>20,'Crosswind must carry the body');
assert(drop(0,1,air).y<compact.y,'Updraft must slow descent');
assert(drop(0,1,{velocityX:0,velocityY:180,density:1}).y>compact.y,'Downburst must speed descent');
assert(drop(0,0,{...CALM_AIR,density:2}).y<vertical.y,'Denser air must add drag');
const coarse=drop(.8,.2,CALM_AIR,1/90), fine=drop(.8,.2,CALM_AIR,1/180);
assert(Math.abs(coarse.y-fine.y)<6,'Air integration must converge with smaller time steps');
assert(projectedArea(0,1,0,500)<projectedArea(Math.PI/2,0,0,500));
const zone={id:'wind',yStart:100,yEnd:300,...air,label:'Crosswind'};
assert.equal(sampleAir([zone],100).velocityX,0,'Layer boundaries must feather in smoothly');
assert.equal(sampleAir([zone],200).velocityX,90);
const inWind=make();
for(let i=0;i<180;i++) stepControlledFlight(inWind,820,0,1/180,{...level,windZones:[{...zone,yStart:-1e6,yEnd:1e6}]});
assert.equal(inWind.bodyAngle,0,'Crosswind must not reintroduce automatic spin');
console.log('PASS: stable controls, smooth tuck, dissipative relative-air drag, pose-dependent braking, wind/updraft/downburst/density effects and timestep convergence.');

const spike={id:'test',baseX1:0,baseY1:0,baseX2:0,baseY2:20,tipX:10,tipY:10,side:'left' as const,stained:0};
assert(nodeHitsSpike({x:20,y:10,radius:2},spike,{x:-5,y:10}),'Fast movement across a spike must not tunnel through it');
assert(!nodeHitsSpike({x:20,y:30,radius:2},spike,{x:-5,y:30}),'A clear swept path must remain safe');
console.log('PASS: swept spike collision and clear-path regression.');
