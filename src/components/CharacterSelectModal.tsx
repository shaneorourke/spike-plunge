import { useEffect, useRef, useState } from 'react';
import { Check, Lock, RotateCcw, X } from 'lucide-react';
import { CHARACTERS } from '../data/characters';
import { drawCharacterPortrait } from '../engine/characterDraw';
import type { CharacterDef, CharacterId, PlayerProgress } from '../types/game';

interface PortraitCanvasProps {
  charId: CharacterId;
  locked: boolean;
}

function PortraitCanvas({ charId, locked }: PortraitCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 52;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    drawCharacterPortrait(ctx, charId, size);
    ctx.restore();
  }, [charId]);

  return (
    <canvas
      ref={ref}
      className={`w-[52px] h-[52px] shrink-0 ${
        locked ? 'opacity-35 grayscale' : ''
      }`}
    />
  );
}

interface CharacterSelectModalProps {
  open: boolean;
  progress: PlayerProgress;
  onSelect: (id: CharacterId) => void;
  onResetAll?: () => void;
  onClose: () => void;
}

export function CharacterSelectModal({
  open,
  progress,
  onSelect,
  onResetAll,
  onClose,
}: CharacterSelectModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const unlockedCount = progress.unlockedIds.length;

  const getUnlockLabel = (char: CharacterDef) => {
    if (char.requiredStreak === 0) return 'Starter';
    return `Clear Lv ${char.requiredStreak} or ${char.requiredTotalJumps} total jumps`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-6"
      onClick={() => {
        setConfirmReset(false);
        onClose();
      }}
    >
      <div
        className="w-full sm:max-w-lg bg-[#11151D] border-t sm:border border-slate-700/80 rounded-t-2xl sm:rounded-xl h-[85dvh] sm:h-[640px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
              Divers · {unlockedCount}/{CHARACTERS.length} Unlocked
            </h2>
            <p className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
              Best Stage: {progress.bestStreak > 0 ? progress.bestStreak : '—'} · Total Clears:{' '}
              {progress.totalJumpsCleared}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmReset(false);
              onClose();
            }}
            aria-label="Close character locker"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          {CHARACTERS.map((char) => {
            const isUnlocked = progress.unlockedIds.includes(char.id);
            const isSelected = progress.selectedCharacter === char.id;

            return (
              <button
                key={char.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  if (isUnlocked) {
                    onSelect(char.id);
                    onClose();
                  }
                }}
                className={`w-full text-left p-3.5 rounded-xl border flex items-center gap-3.5 transition-colors min-h-[82px] ${
                  isSelected
                    ? 'bg-amber-500/12 border-amber-500 text-white'
                    : isUnlocked
                    ? 'bg-[#161B25] border-slate-800 hover:border-slate-600 text-slate-100'
                    : 'bg-[#0E1117] border-slate-800/60 text-slate-500 cursor-not-allowed'
                }`}
              >
                <div className="w-14 h-14 rounded-lg bg-[#0B0D11] border border-slate-800/80 flex items-center justify-center shrink-0">
                  <PortraitCanvas charId={char.id} locked={!isUnlocked} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-bold uppercase tracking-wide truncate">
                      {char.name}
                    </span>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : !isUnlocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                    {char.tagline}
                  </p>
                  {!isUnlocked && (
                    <p className="text-[11px] font-mono text-amber-500/80 mt-1 truncate">
                      {getUnlockLabel(char)}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {onResetAll && (
          <div className="px-5 py-3 border-t border-slate-800/80 bg-[#0E1117] flex items-center justify-between gap-3 shrink-0">
            {confirmReset ? (
              <>
                <span className="text-xs text-red-400 font-medium">
                  Reset stages, unlocks &amp; scores?
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(false);
                      onResetAll();
                    }}
                    className="min-h-[38px] px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wide"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[38px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500">
                  Reset all progress &amp; unlocks
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[38px] px-3 rounded-lg bg-slate-800/80 hover:bg-red-950/70 hover:text-red-300 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Everything
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
