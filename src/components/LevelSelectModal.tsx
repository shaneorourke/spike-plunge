import { useState } from 'react';
import { Check, Lock, Play, RotateCcw, X } from 'lucide-react';
import { generateLevel } from '../engine/levelGen';
import type { PlayerProgress } from '../types/game';

interface LevelSelectModalProps {
  open: boolean;
  currentStage: number;
  progress: PlayerProgress;
  onSelectStage: (stage: number) => void;
  onResetAll?: () => void;
  onClose: () => void;
}

export function LevelSelectModal({
  open,
  currentStage,
  progress,
  onSelectStage,
  onResetAll,
  onClose,
}: LevelSelectModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const maxVisibleStage = Math.max(12, progress.highestStageReached + 3);
  const stages = Array.from({ length: maxVisibleStage }, (_, i) => i + 1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-6"
      onClick={() => {
        setConfirmReset(false);
        onClose();
      }}
    >
      <div
        className="w-full sm:max-w-lg bg-[#11151D] border-t sm:border border-slate-700/80 rounded-t-2xl sm:rounded-xl h-[85dvh] sm:h-[620px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
              Stage Select · 1–{progress.highestStageReached}
            </h2>
            <p className="text-xs font-mono tabular-nums text-slate-400 mt-0.5">
              Revisit any unlocked chute · Completing Stage N advances to N+1
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmReset(false);
              onClose();
            }}
            aria-label="Close stage selector"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5 content-start">
          {stages.map((stageNum) => {
            const unlocked = stageNum <= progress.highestStageReached;
            const stats = progress.stageStats[stageNum];
            const isCleared =
              (stats?.clears ?? 0) > 0 || stageNum <= progress.bestStreak;
            const isCurrent = stageNum === currentStage;
            const isFrontier =
              stageNum === progress.highestStageReached && !isCleared;
            const meta = generateLevel(stageNum);
            const heightMeters = Math.round(
              (meta.floorY - meta.platformY) / 10
            );

            return (
              <button
                key={stageNum}
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (!unlocked) return;
                  setConfirmReset(false);
                  onSelectStage(stageNum);
                  onClose();
                }}
                className={`relative text-left p-3 rounded-xl border flex flex-col justify-between min-h-[86px] transition-colors ${
                  isCurrent
                    ? 'bg-amber-500/14 border-amber-500 text-white'
                    : unlocked
                    ? 'bg-[#161B25] border-slate-800 hover:border-slate-600 text-slate-100'
                    : 'bg-[#0E1117] border-slate-800/50 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span className="font-display text-2xl font-extrabold leading-none tabular-nums">
                    {stageNum}
                  </span>
                  {!unlocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  ) : isCleared ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent || isFrontier ? (
                    <Play className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400" />
                  ) : null}
                </div>

                <div className="mt-2">
                  <div className="text-[10px] text-slate-300 truncate mb-1">{meta.difficultyLabel}</div>
                  <div className="font-mono text-[11px] tabular-nums text-slate-400">
                    {heightMeters}m
                  </div>
                  {unlocked ? (
                    stats && stats.bestSpeedKmh > 0 ? (
                      <div className="font-mono text-[10px] tabular-nums text-amber-400/90 truncate">
                        {stats.bestSpeedKmh} km/h
                      </div>
                    ) : isFrontier ? (
                      <div className="font-mono text-[10px] font-bold uppercase text-amber-400">
                        Frontier
                      </div>
                    ) : (
                      <div className="font-mono text-[10px] text-emerald-400/80">
                        Cleared
                      </div>
                    )
                  ) : (
                    <div className="font-mono text-[10px] text-slate-600">
                      Locked
                    </div>
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
                  Start fresh from Stage 1
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
