import assert from 'node:assert/strict';
import { DEFAULT_AIM, launchAngle } from '../src/engine/aim';
import { generateLevel } from '../src/engine/levelGen';
import { createGoreWorld, createRagdollOnPlatform, getRagdollCenter, launchRagdoll, stepRagdollAndGore } from '../src/engine/ragdoll';
import { referenceInput } from '../src/engine/routePlan';

(globalThis as any).window = {};
type Variation = { elevation?: number; power?: number; timing?: number; heading?: number; constantTuck?: boolean; defaultAim?: boolean };
let simulations = 0;
function dive(stage: number, variation: Variation = {}) {
  simulations++;
  const level = generateLevel(stage), rag = createRagdollOnPlatform(level), gore = createGoreWorld();
  const elevation = variation.defaultAim ? DEFAULT_AIM.elevation : level.reference.elevation + (variation.elevation ?? 0);
  const power = variation.defaultAim ? DEFAULT_AIM.power : level.reference.power + (variation.power ?? 0);
  launchRagdoll(rag,launchAngle(level,elevation),power,level.gravity,1/180);
  for(let frame=0;frame<900 && rag.alive && rag.landTimer<.15;frame++) {
    const depth = (getRagdollCenter(rag).y-level.platformY)/level.shaftHeight;
    const segment = level.reference.segments.find(s => depth >= s.from+(variation.timing??0) && depth < s.to+(variation.timing??0));
    let input = referenceInput(level.reference,depth,rag.bodyAngle,variation.timing??0);
    if(segment && variation.heading) {
      const error = segment.angle + variation.heading - rag.bodyAngle;
      input.rotate = Math.abs(error)<.035 ? 0 : Math.sign(error);
    }
    if(variation.constantTuck !== undefined) input = {tuck:variation.constantTuck,rotate:0};
    stepRagdollAndGore(rag,level,{...input,aimActive:false,aimAngle:0,aimPower:1},gore,1/60,frame/60);
    assert(rag.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)),`Non-finite simulation on ${stage}`);
  }
  return {clear:rag.alive&&rag.landTimer>=.15,cause:rag.fatalCause};
}
const scattered=Array.from({length:128},(_,i)=>(Math.imul(i+1,1597334677)>>>1)+1000);
const stages=[...Array.from({length:512},(_,i)=>i+1),1000,1001,10000,10001,100000,1000000,2147483647,...scattered];
const signatures=new Set<string>();
let posePuzzles=0, complex=0;
for(const [stageIndex,stage] of stages.entries()) {
  const level=generateLevel(stage);
  assert(level.profile.every((p,i)=>p.left>=0&&p.right<=420&&p.right-p.left>=70&&(i===0||p.y>level.profile[i-1].y)),`Invalid shaft geometry ${stage}`);
  assert(level.shaftHeight<=1410,'Difficulty must not grow without bound');
  const signature=JSON.stringify([level.platformSide,level.profile,level.windZones]);
  assert(!signatures.has(signature),`Repeated geometry/airflow at ${stage}`); signatures.add(signature);
  const base=dive(stage);
  assert(base.clear,`Reference route failed stage ${stage}: ${base.cause}`);
  for(const tuck of [false,true]) assert(!dive(stage,{defaultAim:true,constantTuck:tuck}).clear,`Default aim auto-cleared ${stage}`);
  // A useful neighbourhood around the witness, including stance timing and angle.
  if(stage<=128 || stage>=1000) {
    for(const angle of [-.5,0,.5]) for(const power of [-.005,0,.005]) {
      assert(dive(stage,{elevation:angle,power}).clear,`Aim tolerance failed ${stage}: ${angle}/${power}`);
    }
    for(const timing of [-.02,.02]) assert(dive(stage,{timing}).clear,`Stance timing tolerance failed ${stage}: ${timing}`);
    for(const heading of [-Math.PI/60,Math.PI/60]) assert(dive(stage,{heading}).clear,`Body-angle tolerance failed ${stage}`);
  }
  if(level.reference.segments.length) {
    complex++;
    if(!dive(stage,{constantTuck:true}).clear) posePuzzles++;
  }
  if((stageIndex+1)%32===0) console.log(`Validated ${stageIndex+1} stages (latest ${stage}); ${simulations} full physics runs`);
}
assert(posePuzzles>complex*.4,'Pose/airflow changes must matter on a substantial fraction of complex courses');
const clean=generateLevel(19), edited=generateLevel(19);
edited.wallSpikes[0].stained=1; edited.windZones[0].velocityX=999; edited.profile[1].left=0;
assert.deepEqual(generateLevel(19),clean,'Retry cache must not retain world mutations');
// The cushion must stop a whole living body without a numerical rebound.
const pad=generateLevel(1); pad.windZones=[];
const landing=createRagdollOnPlatform(pad), landingGore=createGoreWorld();
const start=getRagdollCenter(landing);
for(const n of landing.nodes) {
  n.x+=210-start.x; n.y+=pad.floorY-90-start.y;
  n.oldX=n.x; n.oldY=n.y-700/180;
}
landing.previousSubDt=1/180; landing.tuckAmount=1;
let firstContactY:number|undefined;
for(let f=0;f<60&&landing.landTimer<.15;f++) {
  stepRagdollAndGore(landing,pad,{tuck:true,aimActive:false,aimAngle:0,aimPower:.5},landingGore,1/60,f/60);
  const y=getRagdollCenter(landing).y;
  if(landing.floorBounceCount>0) {
    firstContactY??=y;
    assert(y>=firstContactY-1,'The landing pad must not launch the body back up the shaft');
  }
}
assert(landing.alive&&landing.landTimer>=.15,'A safe landing must confirm promptly');
console.log(`PASS: ${stages.length} distinct stages, ${simulations} runs; ${posePuzzles}/${complex} complex routes fail if the reference pose changes are ignored.`);
