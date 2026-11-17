import assert from 'node:assert/strict';
import { MIN_ELEVATION, MAX_ELEVATION, MAX_POWER, clampAim, launchAngle } from '../src/engine/aim';
import { launchVelocity } from '../src/engine/aerodynamics';
import { generateLevel } from '../src/engine/levelGen';
import { createGoreWorld, createRagdollOnPlatform, getRagdollCenter, launchRagdoll, stepRagdollAndGore } from '../src/engine/ragdoll';
import { referenceInput } from '../src/engine/routePlan';
(globalThis as any).window={};
function clear(elevation:number,power:number,timing=0) {
 const level=generateLevel(15),rag=createRagdollOnPlatform(level),gore=createGoreWorld();
 launchRagdoll(rag,launchAngle(level,elevation),power,level.gravity,1/180);
 for(let frame=0;frame<900&&rag.alive&&rag.landTimer<.15;frame++) {
  const depth=(getRagdollCenter(rag).y-level.platformY)/level.shaftHeight;
  const input=referenceInput(level.reference,depth,rag.bodyAngle,timing);
  stepRagdollAndGore(rag,level,{...input,aimActive:false,aimAngle:0,aimPower:power},gore,1/60,frame/60);
 }
 return rag.alive&&rag.landTimer>=.15;
}
assert.deepEqual(clampAim({elevation:1,power:2}),{elevation:MIN_ELEVATION,power:MAX_POWER});
assert.equal(clampAim({elevation:100,power:-1}).elevation,MAX_ELEVATION);
const low=launchVelocity(-Math.PI/6,1),high=launchVelocity(-Math.PI/6,MAX_POWER);
assert(Math.hypot(high.vx,high.vy)>Math.hypot(low.vx,low.vy)*1.3,'Extra power must increase actual launch speed');
const shallow=launchVelocity(-MIN_ELEVATION*Math.PI/180,1);
assert(Math.abs(Math.atan2(-shallow.vy,shallow.vx)*180/Math.PI-MIN_ELEVATION)<1e-8,'The extra angle range must affect the actual trajectory');
const winners:{elevation:number;power:number}[]=[];
for(let elevation=20;elevation<=60;elevation+=2.5) for(let p=50;p<=150;p+=5) {
 if(clear(elevation,p/100)) winners.push({elevation,power:p});
}
assert(new Set(winners.map(w=>w.elevation)).size>=3,'Level 15 must have several usable launch angles');
assert(winners.some(w=>w.power>100),'The extended power range must offer viable level-15 routes');
const route=generateLevel(15).reference;
for(const shift of [-.04,0,.04]) assert(clear(Math.round(route.elevation*4)/4,Math.round(route.power*200)/200,shift),'Level 15 must tolerate rounded UI settings and stance timing error');
console.log(`PASS: level 15 clears on ${winners.length} tested launches across ${new Set(winners.map(w=>w.elevation)).size} angles; 0–150% power and 5–89° alter real physics.`,winners.slice(0,8));

// The wider angle/power controls must not hit the former invisible sky ceiling.
const sky=generateLevel(1),highJump=createRagdollOnPlatform(sky),skyGore=createGoreWorld();
sky.windZones=[];
launchRagdoll(highJump,launchAngle(sky,89),MAX_POWER,sky.gravity,1/180);
let top=Infinity;
for(let f=0;f<70;f++) {
 stepRagdollAndGore(highJump,sky,{dive:true,rotate:0,aimActive:false,aimAngle:0,aimPower:MAX_POWER},skyGore,1/60,f/60);
 top=Math.min(top,...highJump.nodes.map(n=>n.y-n.radius));
}
assert(top < -180,'Full-power steep launches must be free to rise above the old sky limit');
console.log('PASS: full-range vertical launch has open sky and no artificial ceiling.');
