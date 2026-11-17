import type { CharacterId, GamePhase, Ragdoll } from '../types/game';
import { getRagdollCenter } from './ragdoll';

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
        limb: '#78350F',
        torso: '#A16207',
        belly: '#CA8A04',
        head: '#B45309',
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
      const col = alive ? (tucking ? '#FDE68A' : '#F8FAFC') : '#E2E8F0';
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
  alive: boolean
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
      ctx.rotate(side * (0.22 + flutter));
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, -8.5, 3.0, 9.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F9A8D4';
      ctx.beginPath();
      ctx.ellipse(0, -8.5, 1.4, 5.8, 0, 0, Math.PI * 2);
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
    ctx.lineTo(0.8, -headRadius - 9.0);
    ctx.lineTo(4.6, -headRadius + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawLimbTipDetails(
  ctx: CanvasRenderingContext2D,
  ragdoll: Ragdoll,
  charId: CharacterId,
  palette: CharPalette
): void {
  const nodes = ragdoll.nodes;
  const armLeftOk = isBoneIntact(ragdoll, 'foreArmL') && isBoneIntact(ragdoll, 'upperArmL');
  const armRightOk = isBoneIntact(ragdoll, 'foreArmR') && isBoneIntact(ragdoll, 'upperArmR');
  const legLeftOk = isBoneIntact(ragdoll, 'shinL') && isBoneIntact(ragdoll, 'thighL');
  const legRightOk = isBoneIntact(ragdoll, 'shinR') && isBoneIntact(ragdoll, 'thighR');

  const hands: { idx: number; elbowIdx: number; ok: boolean }[] = [
    { idx: 5, elbowIdx: 4, ok: armLeftOk },
    { idx: 7, elbowIdx: 6, ok: armRightOk },
  ];
  const feet: { idx: number; kneeIdx: number; ok: boolean }[] = [
    { idx: 9, kneeIdx: 8, ok: legLeftOk },
    { idx: 11, kneeIdx: 10, ok: legRightOk },
  ];

  // Hand/wing details
  for (const h of hands) {
    if (!h.ok) continue;
    const hand = nodes[h.idx];
    const elbow = nodes[h.elbowIdx];
    const ang = Math.atan2(hand.y - elbow.y, hand.x - elbow.x);

    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(ang);

    if (charId === 'sloth') {
      // Three curved ivory claws
      ctx.strokeStyle = '#F5F5F4';
      ctx.lineWidth = 1.6;
      for (const cy of [-2, 0, 2]) {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.quadraticCurveTo(4, cy + 0.5, 5.5, cy + 2.2);
        ctx.stroke();
      }
    } else if (charId === 'chicken') {
      // Feathered wingtip fan
      ctx.fillStyle = '#FEF3C7';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.8, 3.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (charId === 'shark' || charId === 'penguin') {
      // Sleek flipper paddle
      ctx.fillStyle = palette.limb;
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(1.5, 0, 4.5, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (charId === 'bunny') {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, 3.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(0.5, 0, 1.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (charId === 'skeleton') {
      ctx.fillStyle = '#F1F5F9';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Foot/talon/webbed foot details
  for (const f of feet) {
    if (!f.ok) continue;
    const foot = nodes[f.idx];
    const knee = nodes[f.kneeIdx];
    const ang = Math.atan2(foot.y - knee.y, foot.x - knee.x);

    ctx.save();
    ctx.translate(foot.x, foot.y);
    ctx.rotate(ang);

    if (charId === 'chicken' || charId === 'penguin') {
      // Orange webbed/talon feet
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(5.5, -3.2);
      ctx.lineTo(6.2, 0);
      ctx.lineTo(5.5, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (charId === 'frog') {
      // Webbed green toes
      ctx.fillStyle = '#22C55E';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(5.8, -3.8);
      ctx.lineTo(6.8, 0);
      ctx.lineTo(5.8, 3.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (charId === 'bunny') {
      // Long padded rabbit hind foot
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(2.2, 0, 4.6, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (charId === 'sloth') {
      ctx.strokeStyle = '#F5F5F4';
      ctx.lineWidth = 1.5;
      for (const cy of [-1.8, 0, 1.8]) {
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.quadraticCurveTo(3.5, cy + 0.5, 5, cy + 2);
        ctx.stroke();
      }
    } else if (charId === 'skeleton') {
      ctx.fillStyle = '#F1F5F9';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawRagdollCharacter(
  ctx: CanvasRenderingContext2D,
  ragdoll: Ragdoll,
  charId: CharacterId,
  phase: GamePhase,
  speedKmh: number
): void {
  const nodes = ragdoll.nodes;
  const palette = getPalette(charId, ragdoll.tucking, ragdoll.alive);

  // Tuck avoidance silhouette ring
  if (ragdoll.alive && ragdoll.tucking) {
    const c = getRagdollCenter(ragdoll);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Character Limbs (dark outline pass + color fill pass)
  for (const bone of ragdoll.bones) {
    if (bone.severed || bone.isPostureSpring) continue;
    const a = nodes[bone.a];
    const b = nodes[bone.b];

    const isTorso = bone.id === 'neck-chest' || bone.id === 'chest-pelvis';
    const thickBoost =
      charId !== 'stickman' && charId !== 'skeleton'
        ? isTorso
          ? 4.4
          : 1.8
        : 0;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = '#090B0F';
    ctx.lineWidth = bone.thickness + thickBoost + 3.2;
    ctx.stroke();
  }

  for (const bone of ragdoll.bones) {
    if (bone.severed || bone.isPostureSpring) continue;
    const a = nodes[bone.a];
    const b = nodes[bone.b];

    const isTorso = bone.id === 'neck-chest' || bone.id === 'chest-pelvis';
    const thickBoost =
      charId !== 'stickman' && charId !== 'skeleton'
        ? isTorso
          ? 4.4
          : 1.8
        : 0;

    let color = isTorso ? palette.torso : palette.limb;
    if (
      charId === 'chicken' &&
      (bone.id.includes('Arm') || bone.id.includes('arm'))
    ) {
      color = '#FFFBEB';
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = bone.thickness + thickBoost;
    ctx.stroke();
  }

  // Subtle joint dots for stickman (wrists/ankles) & skeleton (elbows/knees)
  if (charId === 'stickman') {
    for (const jIdx of [5, 7, 9, 11]) {
      const n = nodes[jIdx];
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (charId === 'skeleton') {
    for (const jIdx of [4, 6, 8, 10]) {
      const n = nodes[jIdx];
      ctx.fillStyle = '#F1F5F9';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 2. Plump Character Torso Overlays (for animal characters & skeleton ribcage)
  const chest = nodes[2];
  const pelvis = nodes[3];
  const torsoIntact = isBoneIntact(ragdoll, 'chest-pelvis');
  if (torsoIntact && charId !== 'stickman') {
    const tx = (chest.x + pelvis.x) * 0.5;
    const ty = (chest.y + pelvis.y) * 0.5;
    const tAngle =
      Math.atan2(pelvis.y - chest.y, pelvis.x - chest.x) - Math.PI * 0.5;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(tAngle);

    if (charId === 'skeleton') {
      // Bleached curved ribcage bars + pelvis wing
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 3.8;
      for (const ry of [-4.5, -0.5, 3.5]) {
        ctx.beginPath();
        ctx.moveTo(-6, ry);
        ctx.quadraticCurveTo(0, ry + 1.5, 6, ry);
        ctx.stroke();
      }
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 2.0;
      for (const ry of [-4.5, -0.5, 3.5]) {
        ctx.beginPath();
        ctx.moveTo(-6, ry);
        ctx.quadraticCurveTo(0, ry + 1.5, 6, ry);
        ctx.stroke();
      }
      // Hip pelvis bone
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 8.5, 5.2, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const rx =
        charId === 'capybara' || charId === 'penguin' || charId === 'chicken'
          ? 8.8
          : 7.4;
      const ry = 10.8;
      ctx.fillStyle = palette.torso;
      ctx.strokeStyle = '#090B0F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (palette.belly) {
        ctx.fillStyle = palette.belly;
        ctx.beginPath();
        ctx.ellipse(0, 1.2, rx * 0.58, ry * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (charId === 'frog') {
        // Dark emerald amphibian spots
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.arc(-4.5, -4, 1.5, 0, Math.PI * 2);
        ctx.arc(4.8, -2, 1.3, 0, Math.PI * 2);
        ctx.arc(-4.2, 4.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (charId === 'shark') {
        // Gill slits + dorsal fin + forked tail fin
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.2;
        for (const gy of [-4.5, -2.2, 0.1]) {
          ctx.beginPath();
          ctx.moveTo(-rx + 1.5, gy);
          ctx.lineTo(-rx + 4.0, gy + 0.5);
          ctx.stroke();
        }
        // Dorsal fin
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#090B0F';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(rx - 2, -4);
        ctx.lineTo(rx + 8.5, -1);
        ctx.lineTo(rx - 1, 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Forked tail fin at pelvis
        ctx.beginPath();
        ctx.moveTo(-1, ry - 1);
        ctx.lineTo(-5.5, ry + 7);
        ctx.lineTo(0, ry + 4);
        ctx.lineTo(5.5, ry + 7);
        ctx.lineTo(1, ry - 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (charId === 'chicken') {
        // Fluffy tail feathers
        ctx.fillStyle = '#FEF3C7';
        ctx.strokeStyle = '#090B0F';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-3, ry - 2);
        ctx.lineTo(-6.5, ry + 4.5);
        ctx.lineTo(0, ry + 2.5);
        ctx.lineTo(6.5, ry + 4.5);
        ctx.lineTo(3, ry - 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (charId === 'bunny') {
        // Cotton tail
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#090B0F';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(-rx + 1, ry - 3, 4.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Limb tip accessories (claws, flippers, webbed feet, wings, paws)
  drawLimbTipDetails(ctx, ragdoll, charId, palette);

  // Draw crimson stumps where bones were severed
  for (const bone of ragdoll.bones) {
    if (!bone.severed || bone.isPostureSpring) continue;
    const a = nodes[bone.a];
    const b = nodes[bone.b];
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(a.x, a.y, 3.2, 0, Math.PI * 2);
    ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Character Head
  const head = nodes[0];
  const neck = nodes[1];
  const headAngle =
    Math.atan2(head.y - neck.y, head.x - neck.x) + Math.PI * 0.5;
  const r = charId === 'capybara' ? head.radius + 1.3 : head.radius;

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(headAngle);

  drawHeadExtras(ctx, charId, r, speedKmh, ragdoll.alive);

  ctx.beginPath();
  if (charId === 'capybara') {
    ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.75, 5);
  } else if (charId === 'shark') {
    // Slightly pointed hydro-dynamic shark head
    ctx.ellipse(0, 0, r * 1.05, r * 0.96, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = palette.head;
  ctx.fill();
  ctx.strokeStyle = '#090B0F';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawEyesAndFace(
    ctx,
    charId,
    ragdoll.alive,
    phase,
    speedKmh,
    ragdoll.tucking
  );
  ctx.restore();
}

export function drawCharacterPortrait(
  ctx: CanvasRenderingContext2D,
  charId: CharacterId,
  size: number
): void {
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const cy = size * 0.58;
  const palette = getPalette(charId, false, true);

  ctx.save();
  ctx.translate(cx, cy);
  const scale = size / 44;
  ctx.scale(scale, scale);

  // Shoulders / mini torso hint
  if (charId !== 'stickman' && charId !== 'skeleton') {
    ctx.fillStyle = palette.torso;
    ctx.strokeStyle = '#090B0F';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 12, 8.8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (palette.belly) {
      ctx.fillStyle = palette.belly;
      ctx.beginPath();
      ctx.ellipse(0, 13, 4.8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (charId === 'skeleton') {
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 18);
    ctx.moveTo(-6, 11);
    ctx.lineTo(6, 11);
    ctx.moveTo(-5, 15);
    ctx.lineTo(5, 15);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 18);
    ctx.moveTo(-7, 11);
    ctx.lineTo(7, 11);
    ctx.stroke();
  }

  // Head
  const r = charId === 'capybara' ? 9.8 : 9;
  drawHeadExtras(ctx, charId, r, 0, true);

  ctx.beginPath();
  if (charId === 'capybara') {
    ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.75, 5);
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = palette.head;
  ctx.fill();
  ctx.strokeStyle = '#090B0F';
  ctx.lineWidth = 2;
  ctx.stroke();

  drawEyesAndFace(ctx, charId, true, 'READY', 0, false);
  ctx.restore();
}
