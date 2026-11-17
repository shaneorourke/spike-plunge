import type {
  CharacterId,
  GamePhase,
  InputState,
  LevelConfig,
  Ragdoll,
  Spike,
} from '../types/game';
import { advanceAirMotion, airAt, launchVelocity } from './aerodynamics';
import { drawRagdollCharacter } from './characterDraw';
import { getShaftBoundsAtY } from './levelGen';
import { getRagdollCenter, type GoreWorld } from './ragdoll';

export interface RenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  level: LevelConfig;
  ragdoll: Ragdoll;
  gore: GoreWorld;
  phase: GamePhase;
  characterId: CharacterId;
  input: InputState;
  cameraY: number;
  elapsedTime: number;
  speedKmh: number;
}

function drawSpike(ctx: CanvasRenderingContext2D, sp: Spike): void {
  const ax = sp.baseX1;
  const ay = sp.baseY1;
  const bx = sp.baseX2;
  const by = sp.baseY2;

  // Main steel body
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(sp.tipX, sp.tipY);
  ctx.lineTo(bx, by);
  ctx.closePath();
  ctx.fillStyle = '#94A3B8';
  ctx.fill();

  // Top bevel highlight
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(sp.tipX, sp.tipY);
  ctx.lineTo((ax + bx) * 0.5, (ay + by) * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#E2E8F0';
  ctx.fill();

  // Dark outline
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(sp.tipX, sp.tipY);
  ctx.lineTo(bx, by);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Blood stain on tip if hit
  if (sp.stained > 0) {
    ctx.beginPath();
    ctx.moveTo((ax + sp.tipX) * 0.5, (ay + sp.tipY) * 0.5);
    ctx.lineTo(sp.tipX, sp.tipY);
    ctx.lineTo((bx + sp.tipX) * 0.5, (by + sp.tipY) * 0.5);
    ctx.closePath();
    ctx.fillStyle = `rgba(220, 38, 38, ${Math.min(0.95, sp.stained)})`;
    ctx.fill();
  }
}

export function renderGame(params: RenderParams): void {
  const {
    ctx,
    width,
    height,
    level,
    ragdoll,
    gore,
    phase,
    characterId,
    input,
    cameraY,
    elapsedTime,
    speedKmh,
  } = params;

  const scale = width / level.worldWidth;
  const viewWorldHeight = height / scale;

  ctx.save();
  ctx.fillStyle = '#0B0D11';
  ctx.fillRect(0, 0, width, height);

  // Camera shake offset
  const shakeX =
    gore.shake > 0 ? (Math.random() - 0.5) * gore.shake * 1.4 : 0;
  const shakeY =
    gore.shake > 0 ? (Math.random() - 0.5) * gore.shake * 1.4 : 0;

  ctx.scale(scale, scale);
  ctx.translate(shakeX, -cameraY + shakeY);

  const visibleTop = cameraY - 60;
  const visibleBottom = cameraY + viewWorldHeight + 60;

  const topLeft = level.topLeftX;
  const topRight = level.topRightX;
  const topWidth = topRight - topLeft;

  // 1. Open Sky above pit rim + Interior Shaft Concrete Backdrop below rim
  if (visibleTop < level.platformY) {
    ctx.fillStyle = '#0D1017';
    ctx.fillRect(
      0,
      visibleTop,
      level.worldWidth,
      Math.min(visibleBottom, level.platformY) - visibleTop
    );
  }
  const shaftVisTop = Math.max(visibleTop, level.platformY);
  if (visibleBottom > shaftVisTop) {
    ctx.fillStyle = '#12161F';
    ctx.fillRect(0, shaftVisTop, level.worldWidth, visibleBottom - shaftVisTop);

    // Subtle vertical structural shaft ribs inside the V
    ctx.fillStyle = '#161B26';
    ctx.fillRect(
      topLeft + topWidth * 0.3,
      shaftVisTop,
      5,
      visibleBottom - shaftVisTop
    );
    ctx.fillRect(
      topLeft + topWidth * 0.7 - 5,
      shaftVisTop,
      5,
      visibleBottom - shaftVisTop
    );
  }

  // Horizontal steel girders & depth markers every 100px (10m)
  const firstGridY = Math.max(
    level.platformY + 100,
    Math.floor(visibleTop / 100) * 100
  );
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  for (let y = firstGridY; y < Math.min(level.floorY, visibleBottom); y += 100) {
    const bounds = getShaftBoundsAtY(level, y);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.fillRect(bounds.left, y, bounds.width, 2);

    const meters = Math.round((y - level.platformY) / 10);
    if (meters > 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.textAlign = 'center';
      ctx.fillText(`${meters}m`, level.worldWidth * 0.5, y - 10);
    }
  }

  // Visible air layers use the same spatial bounds as the force model.
  for (const zone of level.windZones) {
    const top = Math.max(zone.yStart, visibleTop), bottom = Math.min(zone.yEnd, visibleBottom);
    if (bottom <= top) continue;
    const dense = zone.density > 1.7, thin = zone.density < .8;
    ctx.fillStyle = dense ? 'rgba(251,191,36,.065)' : thin ? 'rgba(196,181,253,.065)' : zone.velocityY > 0 ? 'rgba(251,113,133,.065)' : 'rgba(56,189,248,.065)';
    ctx.fillRect(0, top, level.worldWidth, bottom-top);
    ctx.save();
    ctx.strokeStyle = dense ? 'rgba(251,191,36,.25)' : thin ? 'rgba(196,181,253,.25)' : 'rgba(103,232,249,.25)';
    ctx.lineWidth = 1;
    const direction = Math.atan2(zone.velocityY, zone.velocityX || .001);
    for (let y = Math.floor(top/64)*64; y < bottom; y += 64) {
      if (y < top + 12 || y > bottom - 12) continue;
      const bounds = getShaftBoundsAtY(level,y);
      for (let x = bounds.left + 22; x < bounds.right - 18; x += 40) {
        if(Math.hypot(zone.velocityX,zone.velocityY)<1) {
          ctx.fillStyle=thin ? 'rgba(196,181,253,.25)' : 'rgba(251,191,36,.25)';
          ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fill();continue;
        }
        ctx.save(); ctx.translate(x,y); ctx.rotate(direction);
        const travel = (elapsedTime * 18) % 9;
        ctx.beginPath(); ctx.moveTo(-9+travel,0); ctx.lineTo(7+travel,0);
        ctx.moveTo(3+travel,-3); ctx.lineTo(7+travel,0); ctx.lineTo(3+travel,3); ctx.stroke(); ctx.restore();
      }
    }
    if (zone.yStart > visibleTop && zone.yStart < visibleBottom) {
      const bounds = getShaftBoundsAtY(level,zone.yStart);
      ctx.fillStyle = dense ? '#FBBF24' : thin ? '#C4B5FD' : '#67E8F9'; ctx.textAlign='center';
      ctx.font='700 9px "JetBrains Mono", monospace';
      ctx.fillText(zone.label.toUpperCase(),(bounds.left+bounds.right)/2,zone.yStart+14);
    }
    ctx.restore();
  }

  // 2. Persistent Blood Decals on walls & backdrop
  for (const decal of gore.bloodDecals) {
    if (decal.y < visibleTop - 40 || decal.y > visibleBottom + 40) continue;
    ctx.save();
    ctx.globalAlpha = decal.alpha;
    ctx.fillStyle = decal.color;
    ctx.beginPath();
    ctx.arc(decal.x, decal.y, decal.radius, 0, Math.PI * 2);
    ctx.fill();

    if (decal.dripProgress > 1) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, decal.radius * 0.32);
      ctx.strokeStyle = decal.color;
      ctx.moveTo(decal.x, decal.y);
      ctx.lineTo(decal.x, Math.min(level.floorY, decal.y + decal.dripProgress));
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Outer V-Shaped Sloped Concrete Cliffs (ending at platformY rim)
  ctx.fillStyle = '#1B202B';
  // Left cliff & sloped V-wall polygon
  ctx.beginPath();
  ctx.moveTo(0, level.platformY);
  ctx.lineTo(level.topLeftX, level.platformY);
  for (const p of level.profile.slice(1)) ctx.lineTo(p.left, p.y);
  ctx.lineTo(level.bottomLeftX, Math.max(level.floorY, visibleBottom));
  ctx.lineTo(0, Math.max(level.floorY, visibleBottom));
  ctx.closePath();
  ctx.fill();

  // Right cliff & sloped V-wall polygon
  ctx.beginPath();
  ctx.moveTo(level.worldWidth, level.platformY);
  ctx.lineTo(level.topRightX, level.platformY);
  for (const p of level.profile.slice(1)) ctx.lineTo(p.right, p.y);
  ctx.lineTo(level.bottomRightX, Math.max(level.floorY, visibleBottom));
  ctx.lineTo(level.worldWidth, Math.max(level.floorY, visibleBottom));
  ctx.closePath();
  ctx.fill();

  // Wall steel trim lines along the top outer decks and the V-slopes
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, level.platformY);
  ctx.lineTo(level.topLeftX, level.platformY);
  for (const p of level.profile.slice(1)) ctx.lineTo(p.left, p.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(level.worldWidth, level.platformY);
  ctx.lineTo(level.topRightX, level.platformY);
  for (const p of level.profile.slice(1)) ctx.lineTo(p.right, p.y);
  ctx.stroke();

  // 5. Continuous Side Spikes
  for (const sp of level.wallSpikes) {
    if (sp.baseY2 < visibleTop || sp.baseY1 > visibleBottom) continue;
    drawSpike(ctx, sp);
  }

  // 9. Top Jump Launch Pad embedded flush on the OUTSIDE rim of the V
  if (level.platformY + 40 >= visibleTop && level.platformY - 60 <= visibleBottom) {
    const px = level.platformX;
    const py = level.platformY;
    const pw = level.platformWidth;

    ctx.fillStyle = '#273040';
    ctx.fillRect(px, py, pw, 14);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(px, py, pw, 4);
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, 14);
  }

  // 10. Reinforced Landing Pad (Floor at bottom of V)
  if (level.floorY <= visibleBottom + 40) {
    const fy = level.floorY;
    const floorLeft = level.bottomLeftX;
    const floorRight = level.bottomRightX;
    const floorWidth = floorRight - floorLeft;

    // Cushion pad glow
    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fillRect(floorLeft, fy - 8, floorWidth, 8);

    // Main floor slab
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, fy, level.worldWidth, 120);

    // Safety hazard chevrons across narrow landing strip
    ctx.save();
    ctx.beginPath();
    ctx.rect(floorLeft, fy, floorWidth, 14);
    ctx.clip();
    ctx.fillStyle = '#10B981';
    ctx.fillRect(floorLeft, fy, floorWidth, 4);
    ctx.fillStyle = '#F59E0B';
    for (let sx = floorLeft - 20; sx < floorRight + 20; sx += 24) {
      ctx.beginPath();
      ctx.moveTo(sx, fy + 14);
      ctx.lineTo(sx + 10, fy + 4);
      ctx.lineTo(sx + 18, fy + 4);
      ctx.lineTo(sx + 8, fy + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Label on floor
    ctx.font = '700 11px "Barlow Condensed", sans-serif';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('LANDING ZONE', (floorLeft + floorRight) / 2, fy + 30);
  }

  // 11. Aim Trajectory Preview when ready to jump (integrates real horizontal air drag)
  if (phase === 'READY') {
    const totalMass = ragdoll.nodes.reduce((sum, n) => sum + n.mass, 0);
    const origin = {
      x: ragdoll.nodes.reduce((sum, n) => sum + n.x * n.mass, 0) / totalMass,
      y: ragdoll.nodes.reduce((sum, n) => sum + n.y * n.mass, 0) / totalMass,
    };
    const dirSign = level.platformSide === 'left' ? 1 : -1;
    const angle = input.aimAngle;
    const power = input.aimPower;
    let motion = { x: origin.x, y: origin.y, ...launchVelocity(angle,power,level.gravity) };

    ctx.save();
    for (let dot = 1; dot <= 14; dot++) {
      const stepDt = 0.05;
      // Integrate in small chunks for smooth drag match
      const sub = 9;
      const dtChunk = stepDt / sub;
      for (let s = 0; s < sub; s++) {
        motion = advanceAirMotion(motion,level.gravity,ragdoll.bodyAngle,0,airAt(level,motion.y),dtChunk);
      }
      ctx.beginPath();
      ctx.arc(motion.x, motion.y, Math.max(1.2, 3.2 - dot * 0.14), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 158, 11, ${Math.max(0.18, 0.92 - dot * 0.055)})`;
      ctx.fill();
    }

    // Subtle platform jump hint
    if (!input.aimActive) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.font = '700 11px "Barlow Condensed", sans-serif';
      ctx.textAlign = dirSign > 0 ? 'left' : 'right';
      ctx.fillText(
        'DRAG TO AIM INTO PIT',
        origin.x + dirSign * 14,
        origin.y - 34
      );
    }
    ctx.restore();
  }

  // 12. Dust Particles
  for (const d of gore.dust) {
    const alpha = (1 - d.life / d.maxLife) * 0.55;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(203, 213, 225, ${alpha})`;
    ctx.fill();
  }

  // 13. Ragdoll Character
  drawRagdollCharacter(ctx, ragdoll, characterId, phase, speedKmh);

  // 14. Gibs & Bone Fragments
  for (const g of gore.gibs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    if (g.kind === 'bone') {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-g.size * 1.4, -g.size * 0.35, g.size * 2.8, g.size * 0.7);
    } else {
      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.arc(0, 0, g.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 15. Active Blood Particles
  for (const p of gore.bloodParticles) {
    const alpha = Math.max(0, 1 - p.life / p.maxLife);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 16. Right-wall Depth Progress Mini-Rail (world-anchored at viewport height)
  const railX = level.worldWidth - 9;
  const railTop = cameraY + 78;
  const railH = Math.max(120, viewWorldHeight - 190);
  const center = getRagdollCenter(ragdoll);
  const ratio = Math.max(
    0,
    Math.min(1, (center.y - level.platformY) / (level.floorY - level.platformY))
  );

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(railX - 1.5, railTop, 3, railH);
  // Floor marker
  ctx.fillStyle = '#10B981';
  ctx.fillRect(railX - 4, railTop + railH - 2, 8, 3);
  // Player dot
  ctx.beginPath();
  ctx.arc(railX, railTop + ratio * railH, 4, 0, Math.PI * 2);
  ctx.fillStyle = ragdoll.alive ? '#F59E0B' : '#EF4444';
  ctx.fill();

  ctx.restore();

  // 17. Screen-space Crimson Impact Flash
  if (gore.flashAlpha > 0) {
    ctx.fillStyle = `rgba(220, 38, 38, ${gore.flashAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}
