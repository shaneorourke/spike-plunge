import type { CharacterId, GamePhase, Ragdoll } from '../types/game';
import { createRagdollOnPlatform } from './ragdoll';
import { generateLevel } from './levelGen';
import { stepControlledFlight } from './flightControl';

interface CharPalette {
  limb: string;
  torso: string;
  belly?: string;
  head: string;
  accent: string;
}

function getPalette(
  id: CharacterId,
  tucking: boolean,
  alive: boolean
): CharPalette {
  switch (id) {
    case 'chicken':
      return {
        limb: '#F59E0B',
        torso: '#FFFBEB',
        belly: '#FEF3C7',
        head: '#FFFBEB',
        accent: '#EF4444',
      };
    case 'bunny':
      return {
        limb: '#F1F5F9',
        torso: '#F8FAFC',
        belly: '#FBCFE8',
        head: '#F8FAFC',
        accent: '#F472B6',
      };
    case 'capybara':
      return {
        limb: '#87532E',
        torso: '#B7793F',
        belly: '#E7B879',
        head: '#C58A50',
        accent: '#F97316',
      };
    case 'sloth':
      return {
        limb: '#78716C',
        torso: '#857566',
        belly: '#D6D3D1',
        head: '#A8A29E',
        accent: '#F5F5F4',
      };
    case 'shark':
      return {
        limb: '#475569',
        torso: '#475569',
        belly: '#E2E8F0',
        head: '#64748B',
        accent: '#38BDF8',
      };
    case 'frog':
      return {
        limb: '#22C55E',
        torso: '#4ADE80',
        belly: '#FEF08A',
        head: '#4ADE80',
        accent: '#15803D',
      };
    case 'penguin':
      return {
        limb: '#1E293B',
        torso: '#1E293B',
        belly: '#F8FAFC',
        head: '#0F172A',
        accent: '#F59E0B',
      };
    case 'skeleton':
      return {
        limb: '#E2E8F0',
        torso: '#E2E8F0',
        head: '#F1F5F9',
        accent: '#94A3B8',
      };
    case 'stickman':
    default: {
      const col = alive ? '#F8FAFC' : '#CBD5E1';
      return { limb: col, torso: col, head: col, accent: '#F59E0B' };
    }
  }
}

function isBoneIntact(ragdoll: Ragdoll, boneId: string): boolean {
  const b = ragdoll.bones.find((item) => item.id === boneId);
  return b ? !b.severed : false;
}

function drawEyesAndFace(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  alive: boolean,
  phase: GamePhase,
  speedKmh: number,
  tucking: boolean
): void {
  ctx.strokeStyle = '#0F172A';
  ctx.fillStyle = '#0F172A';
  ctx.lineWidth = 1.4;

  if (!alive) {
    // X_X eyes for every dead character
    const ey = id === 'frog' ? -4 : -1;
    for (const ex of [-3.2, 3.2]) {
      ctx.beginPath();
      ctx.moveTo(ex - 1.7, ey - 1.7);
      ctx.lineTo(ex + 1.7, ey + 1.7);
      ctx.moveTo(ex + 1.7, ey - 1.7);
      ctx.lineTo(ex - 1.7, ey + 1.7);
      ctx.stroke();
    }
    return;
  }

  if (id === 'capybara') {
    // Broad chill snout + nostrils + half-lidded eyes
    ctx.fillStyle = '#713F12';
    ctx.beginPath();
    ctx.ellipse(0, 3.3, 6.0, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chill horizontal eyelids
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-5.2, -1.6);
    ctx.lineTo(-1.6, -1.3);
    ctx.moveTo(1.6, -1.3);
    ctx.lineTo(5.2, -1.6);
    ctx.stroke();

    // Nostrils & subtle mouth line
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-1.9, 2.5, 0.95, 0, Math.PI * 2);
    ctx.arc(1.9, 2.5, 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 3.6);
    ctx.lineTo(0, 5.1);
    ctx.stroke();
    return;
  }

  if (id === 'sloth') {
    // Cream face mask + dark diagonal eye patches
    ctx.fillStyle = '#F5F5F4';
    ctx.beginPath();
    ctx.ellipse(0, 0.6, 7.1, 5.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#44403C';
    ctx.beginPath();
    ctx.ellipse(-3.1, -0.6, 2.5, 1.9, -0.35, 0, Math.PI * 2);
    ctx.ellipse(3.1, -0.6, 2.5, 1.9, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-2.8, -0.6, 1.05, 0, Math.PI * 2);
    ctx.arc(2.8, -0.6, 1.05, 0, Math.PI * 2);
    ctx.fill();

    // Button nose & peaceful smile
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.ellipse(0, 1.4, 1.4, 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1C1917';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 2.4, 2.6, 0.25, Math.PI - 0.25);
    ctx.stroke();
    return;
  }

  if (id === 'shark') {
    // Fierce eyes with white sclera glints + brow
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-3.6, -2.1, 1.45, 0, Math.PI * 2);
    ctx.arc(3.6, -2.1, 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(-3.2, -2.4, 0.5, 0, Math.PI * 2);
    ctx.arc(4.0, -2.4, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Angry slanted brow lines
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-5.3, -4.1);
    ctx.lineTo(-2.1, -3.1);
    ctx.moveTo(5.3, -4.1);
    ctx.lineTo(2.1, -3.1);
    ctx.stroke();

    // Open mouth + jagged individual sawtooth teeth
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.arc(0, 2.8, 5.0, 0.1, Math.PI - 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    for (let tx = -3.8; tx <= 3.0; tx += 2.2) {
      ctx.beginPath();
      ctx.moveTo(tx, 3.0);
      ctx.lineTo(tx + 1.0, 5.2);
      ctx.lineTo(tx + 2.0, 3.0);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  if (id === 'chicken') {
    // Wide startled eyes + two-tone beak (squawking open at high speed)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3.1, -1.6, 1.9, 0, Math.PI * 2);
    ctx.arc(3.1, -1.6, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-3.0, -1.6, 1.05, 0, Math.PI * 2);
    ctx.arc(3.0, -1.6, 1.05, 0, Math.PI * 2);
    ctx.fill();

    // Upper beak
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(-2.8, 1.0);
    ctx.lineTo(2.8, 1.0);
    ctx.lineTo(0, 4.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (phase === 'FALLING' && speedKmh > 55) {
      // Open squawking lower beak
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.arc(0, 3.6, 1.8, 0, Math.PI);
      ctx.fill();
    }
    return;
  }

  if (id === 'bunny') {
    // Expressive eyes + blush + whiskers + pink nose + buck teeth
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-3.1, -1.2, 1.35, 0, Math.PI * 2);
    ctx.arc(3.1, -1.2, 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2.7, -1.6, 0.45, 0, Math.PI * 2);
    ctx.arc(3.5, -1.6, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Rosy cheeks
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.arc(-4.8, 1.2, 1.5, 0, Math.PI * 2);
    ctx.arc(4.8, 1.2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-3.5, 1.4);
    ctx.lineTo(-7.2, 0.6);
    ctx.moveTo(-3.5, 2.2);
    ctx.lineTo(-7.2, 2.6);
    ctx.moveTo(3.5, 1.4);
    ctx.lineTo(7.2, 0.6);
    ctx.moveTo(3.5, 2.2);
    ctx.lineTo(7.2, 2.6);
    ctx.stroke();

    // Nose & buck teeth
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.arc(0, 1.4, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 0.7;
    ctx.fillRect(-1.5, 2.9, 1.4, 2.1);
    ctx.strokeRect(-1.5, 2.9, 1.4, 2.1);
    ctx.fillRect(0.1, 2.9, 1.4, 2.1);
    ctx.strokeRect(0.1, 2.9, 1.4, 2.1);
    return;
  }

  if (id === 'frog') {
    // Bulging top golden eyes with horizontal slit pupils
    for (const ex of [-4.4, 4.4]) {
      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(ex, -7.2, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(ex, -7.2, 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(ex, -7.2, 1.35, 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rosy cheeks + wide grin
    ctx.fillStyle = 'rgba(248, 113, 113, 0.4)';
    ctx.beginPath();
    ctx.arc(-5.2, 0.5, 1.5, 0, Math.PI * 2);
    ctx.arc(5.2, 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 1.2, 4.7, 0.2, Math.PI - 0.2);
    ctx.stroke();
    return;
  }

  if (id === 'penguin') {
    // Crisp white cheek mask + glossy eyes + blush + amber beak
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.ellipse(-3.1, 0.3, 2.8, 3.8, 0, 0, Math.PI * 2);
    ctx.ellipse(3.1, 0.3, 2.8, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-3.1, -1.0, 1.2, 0, Math.PI * 2);
    ctx.arc(3.1, -1.0, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-2.7, -1.4, 0.4, 0, Math.PI * 2);
    ctx.arc(3.5, -1.4, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-2.7, 1.4);
    ctx.lineTo(2.7, 1.4);
    ctx.lineTo(0, 5.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    return;
  }

  if (id === 'skeleton') {
    // Hollow dark sockets with faint amber eye glints + nasal triangle + grin teeth
    ctx.fillStyle = '#090B0F';
    ctx.beginPath();
    ctx.arc(-3.1, -1.2, 2.2, 0, Math.PI * 2);
    ctx.arc(3.1, -1.2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(-3.1, -1.2, 0.75, 0, Math.PI * 2);
    ctx.arc(3.1, -1.2, 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Nasal cavity
    ctx.fillStyle = '#090B0F';
    ctx.beginPath();
    ctx.moveTo(0, 0.2);
    ctx.lineTo(-1.1, 2.1);
    ctx.lineTo(1.1, 2.1);
    ctx.closePath();
    ctx.fill();

    // Grinning teeth row
    ctx.fillRect(-3.6, 3.2, 7.2, 2.4);
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const tx of [-1.8, 0, 1.8]) {
      ctx.moveTo(tx, 3.2);
      ctx.lineTo(tx, 5.6);
    }
    ctx.stroke();
    return;
  }

  // Classic Stickman Stunt Diver
  if (tucking) {
    // Focused determined eyes + clenched line
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-2.8, -0.8, 1.25, 0, Math.PI * 2);
    ctx.arc(2.8, -0.8, 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-4.4, -2.9);
    ctx.lineTo(-1.5, -2.0);
    ctx.moveTo(4.4, -2.9);
    ctx.lineTo(1.5, -2.0);
    ctx.moveTo(-2.0, 3.1);
    ctx.lineTo(2.0, 3.1);
    ctx.stroke();
  } else if (phase === 'FALLING' && speedKmh > 65) {
    ctx.beginPath();
    ctx.arc(-3, -1, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 3.6, 1.9, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-2.8, -1, 1.2, 0, Math.PI * 2);
    ctx.arc(2.8, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeadExtras(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  headRadius: number,
  speedKmh: number,
  alive: boolean,
  tuck = 0
): void {
  const flutter = Math.min(0.55, speedKmh * 0.0038);

  if (id === 'stickman') {
    // Stunt headband with fluttering amber cloth tails
    ctx.save();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-headRadius + 0.5, -3.6);
    ctx.lineTo(headRadius - 0.5, -3.6);
    ctx.stroke();

    // Fluttering headband ribbons trailing behind
    const ribbonAngle = -0.35 - flutter * 1.1;
    ctx.beginPath();
    ctx.moveTo(-headRadius + 0.5, -3.6);
    ctx.lineTo(
      -headRadius - 6.5 * Math.cos(ribbonAngle),
      -3.6 - 6.5 * Math.sin(ribbonAngle) - flutter * 5
    );
    ctx.moveTo(-headRadius + 0.5, -3.2);
    ctx.lineTo(
      -headRadius - 5.2 * Math.cos(ribbonAngle + 0.25),
      -2.2 - 5.2 * Math.sin(ribbonAngle + 0.25) - flutter * 3
    );
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  } else if (id === 'chicken') {
    // Scalloped red comb + chin wattle
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#090B0F';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-3.2, -headRadius - 0.8, 3.1, Math.PI, 0);
    ctx.arc(0, -headRadius - 2.8, 3.4, Math.PI, 0);
    ctx.arc(3.2, -headRadius - 0.8, 2.9, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, headRadius + 1.6, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (id === 'bunny') {
    // Tall floppy ears with wind flex
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 4.2, -headRadius + 1.2);
      ctx.rotate(side * (0.12 + flutter * .35 + tuck * 1.1));
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, -5.5 + tuck * 2, 2.8, 6.5 - tuck * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F9A8D4';
      ctx.beginPath();
      ctx.ellipse(0, -5.5 + tuck * 2, 1.3, 4.2 - tuck * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (id === 'capybara') {
    // Rounded ears + iconic yuzu/tangerine balanced on head!
    ctx.fillStyle = '#92400E';
    ctx.strokeStyle = '#090B0F';
    ctx.lineWidth = 1.4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 6.8, -headRadius + 2.4, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (alive) {
      // Yuzu orange + tiny green leaf
      ctx.fillStyle = '#F97316';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, -headRadius - 1.2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.ellipse(2.0, -headRadius - 4.0, 2.2, 1.1, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'shark') {
    // Sleek pointed dorsal crest on head
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#090B0F';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-3.2, -headRadius + 1);
    ctx.lineTo(0.8, -headRadius - 5.0 + tuck * 3);
    ctx.lineTo(4.6, -headRadius + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

const INK = '#111827';

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = true) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) { ctx.strokeStyle = INK; ctx.lineWidth = 1.35; ctx.stroke(); }
}

function material(ctx: CanvasRenderingContext2D, color: string, top: number, bottom: number) {
  const shade = ctx.createLinearGradient(-6, top, 7, bottom);
  shade.addColorStop(0, color);
  shade.addColorStop(.6, color);
  shade.addColorStop(1, '#334155');
  return shade;
}

function segment(ctx: CanvasRenderingContext2D, rag: Ragdoll, id: string, width: number, color: string, highlight = true) {
  const bone = rag.bones.find(b => b.id === id);
  if (!bone || bone.severed) return;
  const a = rag.nodes[bone.a], b = rag.nodes[bone.b];
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = INK; ctx.lineWidth = width + 2.4; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  if (highlight) {
    ctx.beginPath();
    ctx.moveTo(a.x - .6, a.y - .5); ctx.lineTo(b.x - .6, b.y - .5);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = .8; ctx.stroke();
  }
}

function drawArmOrLeg(ctx: CanvasRenderingContext2D, rag: Ragdoll, charId: CharacterId, p: CharPalette, side: 'L' | 'R', leg: boolean) {
  const animal = charId !== 'stickman' && charId !== 'skeleton';
  const flipper = !leg && (charId === 'shark' || charId === 'penguin');
  const wing = !leg && charId === 'chicken';
  const ids = leg ? [`thigh${side}`, `shin${side}`] : [`upperArm${side}`, `foreArm${side}`];
  const width = charId === 'skeleton' ? 2.6 : flipper ? 5.8 : wing ? 5.5 : animal ? 4.8 : 3.6;
  const color = wing ? p.torso : p.limb;
  ids.forEach(id => segment(ctx, rag, id, width, color));
  const endIndex = leg ? (side === 'L' ? 9 : 11) : (side === 'L' ? 5 : 7);
  const previousIndex = endIndex - 1;
  if (!isBoneIntact(rag, ids[1])) return;
  const tip = rag.nodes[endIndex], previous = rag.nodes[previousIndex];
  ctx.save(); ctx.translate(tip.x, tip.y);
  ctx.rotate(Math.atan2(tip.y - previous.y, tip.x - previous.x) - Math.PI / 2);
  if (wing) {
    ellipse(ctx, 0, .6, 3.4, 3.5, '#FFF6D9');
    ctx.strokeStyle = '#C7AD7C'; ctx.lineWidth = .7;
    for (const x of [-1.3, 1.3]) { ctx.beginPath(); ctx.moveTo(x, -.3); ctx.lineTo(x, 2.4); ctx.stroke(); }
  } else if (flipper) {
    ctx.beginPath(); ctx.moveTo(-2.8,-3); ctx.quadraticCurveTo(-3.8,2,0,4.5);
    ctx.quadraticCurveTo(3.8,2,2.8,-3); ctx.closePath();
    ctx.fillStyle = p.limb; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
  } else if (leg && (charId === 'penguin' || charId === 'chicken')) {
    ellipse(ctx, 0, .7, 4, 2.4, '#FFB547');
    ctx.strokeStyle = '#AD5D20'; ctx.lineWidth = .7;
    for (const x of [-1.3, 1.3]) { ctx.beginPath(); ctx.moveTo(x, .6); ctx.lineTo(x, 2); ctx.stroke(); }
  } else if (charId === 'frog') {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.8;
    for (const x of [-2.5, 0, 2.5]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, 2.4); ctx.stroke(); }
    for (const x of [-2.5, 0, 2.5]) ellipse(ctx, x, 2.4, 1.1, 1.1, '#86EFAC', false);
  } else if (charId === 'sloth') {
    ellipse(ctx, 0, 0, 2.9, 2.7, p.limb);
    ctx.strokeStyle = '#F7EAD5'; ctx.lineWidth = 1.1;
    for (const x of [-1.6, 0, 1.6]) { ctx.beginPath(); ctx.moveTo(x, 1); ctx.quadraticCurveTo(x + .5, 4, x + 1, 3.7); ctx.stroke(); }
  } else if (leg && charId === 'bunny') {
    ellipse(ctx, 0, .5, 3.7, 3, p.head);
    ellipse(ctx, 0, 1, 1.7, 1, '#F9A8D4', false);
  } else if (charId === 'stickman') {
    ellipse(ctx, 0, .2, leg ? 3.3 : 2.6, leg ? 2.2 : 2.5, '#FBBF24');
    if (leg) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, 1.8); ctx.lineTo(2, 1.8); ctx.stroke(); }
  } else if (charId === 'capybara') {
    ellipse(ctx, 0, .3, 3.1, 2.8, '#87532E');
    ctx.strokeStyle = '#E7B879'; ctx.lineWidth = .65;
    for (const x of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, .5); ctx.lineTo(x, 1.8); ctx.stroke(); }
  } else if (charId === 'bunny' || charId === 'skeleton') {
    ellipse(ctx, 0, 0, 2.6, 2.6, p.head);
  }
  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, rag: Ragdoll, id: CharacterId, p: CharPalette) {
  if (!isBoneIntact(rag, 'chest-pelvis')) return;
  const chest = rag.nodes[2], hips = rag.nodes[3];
  ctx.save();
  ctx.translate((chest.x + hips.x) / 2, (chest.y + hips.y) / 2);
  ctx.rotate(Math.atan2(hips.y - chest.y, hips.x - chest.x) - Math.PI / 2);
  const tuck = rag.tuckAmount;
  const plump = id === 'capybara' || id === 'penguin' || id === 'chicken';
  const ry = (plump ? 12 : 10) - tuck * (plump ? 3.5 : 1.8);
  const rx = id === 'capybara' ? 8.5 : id === 'penguin' ? 8 : id === 'chicken' ? 8.6 : id === 'stickman' ? 4.8 : 6.2;

  if (id === 'shark') {
    ctx.fillStyle = '#5C94B3'; ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(12 - tuck * 5, 0); ctx.lineTo(3, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (tuck < .8) {
      ctx.beginPath(); ctx.moveTo(-2,ry-3); ctx.lineTo(-5,ry+5-tuck*5);
      ctx.lineTo(0,ry+2); ctx.lineTo(5,ry+5-tuck*5); ctx.lineTo(2,ry-3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  if (id === 'bunny') ellipse(ctx, -rx + 1, 4, 3.3 - tuck, 3.3 - tuck, '#FFFFFF');

  if (id === 'skeleton') {
    ctx.strokeStyle = '#E8E2D5'; ctx.lineWidth = 2.3;
    ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#F7F0DF';
    for (const y of [-6, -2, 2]) {
      ctx.beginPath(); ctx.moveTo(-5, y - 1); ctx.quadraticCurveTo(-6, y + 2, 0, y + 2.5); ctx.quadraticCurveTo(6, y + 2, 5, y - 1); ctx.stroke();
    }
    ellipse(ctx, 0, 7, 4.8, 2.6, '#D5CDBE');
  } else {
    ctx.beginPath();
    if (id === 'capybara' || id === 'stickman') ctx.roundRect(-rx, -ry, rx * 2, ry * 2, id === 'capybara' ? 4.5 : 3);
    else ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = material(ctx, p.torso, -ry, ry); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    if (p.belly) ellipse(ctx, 0, 1, rx * .63, ry * .77, p.belly, false);
    if (id === 'stickman') {
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(2, 6); ctx.moveTo(3, -7); ctx.lineTo(-2, 6); ctx.stroke();
      ctx.fillStyle = '#FBBF24'; ctx.fillRect(-2, -1, 4, 3);
      ctx.fillStyle = '#64748B'; ctx.fillRect(-rx, 5, rx * 2, 2);
    }
    if (id === 'frog') for (const [x, y] of [[-4,-4],[4,-3],[-4,3]]) ellipse(ctx,x,y,1.1,1.4,'#15803D',false);
    if (id === 'shark') {
      ctx.strokeStyle = '#243C54'; ctx.lineWidth = .9;
      for (const y of [-4, -1, 2]) { ctx.beginPath(); ctx.moveTo(-4.6,y); ctx.lineTo(-2.7,y+1); ctx.stroke(); }
    }
    if (id === 'chicken') {
      ctx.strokeStyle = '#D6B97E'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(-3,3); ctx.lineTo(-1,5); ctx.lineTo(1,3); ctx.lineTo(3,5); ctx.stroke();
    }
    if (id === 'penguin' || id === 'bunny') {
      ctx.fillStyle = p.accent; ctx.strokeStyle = INK; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(-3.4,-8); ctx.lineTo(-3.4,-4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(3.4,-8); ctx.lineTo(3.4,-4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, id: CharacterId, p: CharPalette, r: number, alive: boolean, phase: GamePhase, speed: number, tuck: number) {
  drawHeadExtras(ctx, id, r, speed, alive, tuck);
  ctx.beginPath();
  if (id === 'capybara') ctx.roundRect(-r, -r * .8, r * 2, r * 1.7, 4.2);
  else if (id === 'shark') ctx.ellipse(0, .2, r * 1.07, r * .9, 0, 0, Math.PI * 2);
  else ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = material(ctx, p.head, -r, r * 1.8); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  // A restrained rim highlight reads at the actual playfield size.
  ctx.beginPath(); ctx.arc(-.5, -.5, r - 1.5, -Math.PI * .95, -Math.PI * .35);
  ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1; ctx.stroke();
  drawEyesAndFace(ctx, id, alive, phase, speed, tuck > .65);
  if (id === 'stickman') {
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip();
    ctx.fillStyle = '#FBBF24'; ctx.fillRect(-r,-5.5,r*2,2.8);
    ctx.fillStyle = '#FFFBEB'; ctx.fillRect(-r,-5.5,r*2,.7); ctx.restore();
  }
}

export function drawRagdollCharacter(ctx: CanvasRenderingContext2D, rag: Ragdoll, id: CharacterId, phase: GamePhase, speedKmh: number): void {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const p = getPalette(id, rag.tucking, rag.alive);
  // Back limbs first, then the body and foreground limbs: tucks stay readable.
  ctx.save(); ctx.globalAlpha *= .78;
  drawArmOrLeg(ctx, rag, id, p, 'L', true);
  drawArmOrLeg(ctx, rag, id, p, 'L', false);
  ctx.restore();
  segment(ctx, rag, 'neck-chest', id === 'skeleton' ? 2.8 : 4, p.torso);
  drawTorso(ctx, rag, id, p);
  drawArmOrLeg(ctx, rag, id, p, 'R', true);
  drawArmOrLeg(ctx, rag, id, p, 'R', false);
  for (const bone of rag.bones) {
    if (!bone.severed || bone.isPostureSpring) continue;
    for (const index of [bone.a, bone.b]) ellipse(ctx, rag.nodes[index].x, rag.nodes[index].y, 2.3, 2.3, '#DC2626', false);
  }
  const head = rag.nodes[0], neck = rag.nodes[1];
  ctx.save(); ctx.translate(head.x, head.y);
  ctx.rotate(Math.atan2(head.y - neck.y, head.x - neck.x) + Math.PI / 2);
  drawHead(ctx, id, p, head.radius, rag.alive, phase, speedKmh, rag.tuckAmount);
  ctx.restore(); ctx.restore();
}

export function drawCharacterPortrait(ctx: CanvasRenderingContext2D, id: CharacterId, size: number): void {
  ctx.clearRect(0, 0, size, size);
  ctx.save(); ctx.translate(size / 2, size * .58); ctx.scale(size / 36, size / 36);
  const p = getPalette(id, false, true);
  ellipse(ctx,0,14,8,7,p.torso);
  drawHead(ctx, id, p, 8.5, true, 'READY', 0, 0);
  ctx.restore();
}

export type ModelPose = 'ready' | 'tucked' | 'rotated';

export function drawCharacterModelPreview(ctx: CanvasRenderingContext2D, id: CharacterId, width: number, height: number, pose: ModelPose) {
  ctx.clearRect(0, 0, width, height);
  const rag = createRagdollOnPlatform(generateLevel(1));
  rag.tucking = pose === 'tucked';
  rag.tuckAmount = rag.tucking ? 1 : 0;
  rag.bodyAngle = pose === 'rotated' ? Math.PI / 2 : 0;
  stepControlledFlight(rag, 0, 0, 1 / 180);
  const mass = rag.nodes.reduce((sum,n) => sum+n.mass,0);
  const cx = rag.nodes.reduce((sum,n) => sum+n.x*n.mass,0) / mass;
  const cy = rag.nodes.reduce((sum,n) => sum+n.y*n.mass,0) / mass;
  const scale = Math.min(width / 90, height / 92);
  ctx.save(); ctx.translate(width / 2, height * .55); ctx.scale(scale,scale); ctx.translate(-cx,-cy);
  drawRagdollCharacter(ctx,rag,id,rag.tucking ? 'FALLING' : 'READY',0);
  ctx.restore();
}
