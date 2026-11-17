import type { LevelConfig } from '../types/game';
import { getShaftBoundsAtY } from '../engine/levelGen';

export function LevelScout({ level }: { level: LevelConfig }) {
  const points = level.profile;
  const mapY = (y: number) => 24 + (y - level.platformY) / level.shaftHeight * 248;
  const left = points.map(p => `${p.left},${mapY(p.y)}`).join(' ');
  const right = [...points].reverse().map(p => `${p.right},${mapY(p.y)}`).join(' ');
  const clipId = `survey-${level.seed}`;
  return <div className="absolute inset-0 z-20 bg-[#0B0D11]/95 p-5 flex flex-col justify-center gap-3">
    <div className="text-[10px] font-mono tracking-[.22em] text-cyan-400">SHAFT SURVEY / STAGE {level.level} / {level.seed}</div>
    <h2 className="font-display text-3xl font-extrabold uppercase">{level.family}</h2>
    <svg viewBox="0 0 420 300" className="w-full max-h-[37vh]" role="img" aria-label="Full shaft map. Red walls are spikes. Blue layers show moving air, amber layers show dense air, purple marks thin air, and green marks the landing pad.">
      <defs><clipPath id={clipId}><polygon points={`${left} ${right}`} /></clipPath></defs>
      <polygon points={`${left} ${right}`} fill="#151d2b" stroke="#475569" strokeWidth="2" />
      {level.windZones.map(zone => {
        const y = (zone.yStart+zone.yEnd)/2;
        const bounds = getShaftBoundsAtY(level,y);
        return <g key={zone.id}>
          <rect x="0" width="420" y={mapY(zone.yStart)} height={mapY(zone.yEnd)-mapY(zone.yStart)}
            fill={zone.density > 1.7 ? '#FBBF24' : zone.density < .8 ? '#C4B5FD' : zone.velocityY > 0 ? '#FB7185' : '#38BDF8'} opacity=".18" clipPath={`url(#${clipId})`} />
          <text x={(bounds.left+bounds.right)/2} y={mapY(y)} textAnchor="middle" fontSize="13" fill={zone.density > 1.7 ? '#FBBF24' : zone.density < .8 ? '#C4B5FD' : '#67E8F9'}
            stroke="#0B0D11" strokeWidth="3" paintOrder="stroke">
            {zone.velocityX ? `${zone.velocityX > 0 ? '→' : '←'} ${Math.round(Math.abs(zone.velocityX)/10)}` : ''}
            {zone.velocityY ? ` ${zone.velocityY > 0 ? '↓' : '↑'} ${Math.round(Math.abs(zone.velocityY)/10)}` : ''}
            {zone.density > 1.7 ? ' DENSE' : zone.density < .8 ? 'THIN' : ''}
          </text>
        </g>;
      })}
      <polyline points={left} fill="none" stroke="#fb7185" strokeWidth="4" />
      <polyline points={right} fill="none" stroke="#fb7185" strokeWidth="4" />
      <line x1={level.bottomLeftX} x2={level.bottomRightX} y1="272" y2="272" stroke="#34d399" strokeWidth="6" />
      <circle cx={level.platformSide === 'left' ? level.topLeftX-14 : level.topRightX+14} cy="18" r="6" fill="#fbbf24" />
      <text x="210" y="294" textAnchor="middle" fill="#94a3b8" fontSize="11">{Math.round(level.shaftHeight/10)}m · air speeds in m/s</text>
    </svg>
    <p className="text-sm text-slate-300 leading-relaxed">{level.briefing}</p>
    <p className="text-[10px] text-cyan-300">{level.windZones.map(z => z.label).join(' / ') || 'Still air · learn to use drag before the currents arrive'}</p>
    <p className="font-mono text-[10px] text-slate-500">Dive cuts drag. Open broadside to brake and catch more wind. Air stays identical on every retry.</p>
  </div>;
}
