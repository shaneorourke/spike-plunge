import type { LevelConfig } from '../types/game';

export function LevelScout({ level }: { level: LevelConfig }) {
  const points = level.profile;
  const mapY = (y: number) => 24 + (y - level.platformY) / level.shaftHeight * 248;
  const left = points.map(p => `${p.left},${mapY(p.y)}`).join(' ');
  const right = [...points].reverse().map(p => `${p.right},${mapY(p.y)}`).join(' ');
  return <div className="absolute inset-0 z-20 bg-[#0B0D11]/95 p-5 flex flex-col justify-center gap-3">
    <div className="text-[10px] font-mono tracking-[.22em] text-cyan-400">SHAFT SURVEY / STAGE {level.level}</div>
    <h2 className="font-display text-3xl font-extrabold uppercase">{level.difficultyLabel}</h2>
    <svg viewBox="0 0 420 300" className="w-full max-h-[42vh]" role="img" aria-label="Full shaft map. Red edges mark spikes; green line marks the landing pad.">
      <polygon points={`${left} ${right}`} fill="#151d2b" stroke="#475569" strokeWidth="2" />
      <polyline points={left} fill="none" stroke="#fb7185" strokeWidth="5" />
      <polyline points={right} fill="none" stroke="#fb7185" strokeWidth="5" />
      <line x1={level.bottomLeftX} x2={level.bottomRightX} y1="272" y2="272" stroke="#34d399" strokeWidth="6" />
      <circle cx={level.platformSide === 'left' ? level.topLeftX - 14 : level.topRightX + 14} cy="18" r="6" fill="#fbbf24" />
      <text x="210" y="294" textAnchor="middle" fill="#94a3b8" fontSize="11">{Math.round(level.shaftHeight / 10)}m · full shaft, vertically compressed</text>
    </svg>
    <p className="text-sm text-slate-300 leading-relaxed">{level.briefing}</p>
    <p className="font-mono text-[10px] text-slate-500">Red walls are lethal. The map shows the wall outline; spikes project into the passage.</p>
  </div>;
}
