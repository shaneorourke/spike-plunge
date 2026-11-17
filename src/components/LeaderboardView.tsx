import { useState } from 'react';
import { Play, Trash2, Trophy } from 'lucide-react';
import type { LeaderboardEntry, PlayerProgress } from '../types/game';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  progress: PlayerProgress;
  currentStage: number;
  callsign: string;
  onChangeCallsign: (name: string) => void;
  onClear: () => void;
  onSelectStage: (stage: number) => void;
  highlightId?: string | null;
}

export function LeaderboardView({
  entries,
  progress,
  currentStage,
  callsign,
  onChangeCallsign,
  onClear,
  onSelectStage,
  highlightId,
}: LeaderboardViewProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [tab, setTab] = useState<'divers' | 'stages'>('divers');

  const unlockedStages = Array.from(
    { length: progress.highestStageReached },
    (_, i) => progress.highestStageReached - i
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
          <h2 className="font-display text-lg font-bold tracking-wide text-slate-100 uppercase">
            Leaderboard
          </h2>
        </div>

        {entries.length > 0 && tab === 'divers' && (
          <div className="flex items-center gap-2 shrink-0">
            {confirmClear ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setConfirmClear(false);
                  }}
                  className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors whitespace-nowrap"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                aria-label="Clear local scores"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors rounded-md"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Segmented View Toggle */}
      <div className="grid grid-cols-2 gap-1.5 py-2.5 border-b border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => setTab('divers')}
          className={`min-h-[38px] rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
            tab === 'divers'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-800/80 text-slate-300 hover:text-white'
          }`}
        >
          Diver Standings
        </button>
        <button
          type="button"
          onClick={() => setTab('stages')}
          className={`min-h-[38px] rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
            tab === 'stages'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-800/80 text-slate-300 hover:text-white'
          }`}
        >
          Stage Records ({progress.highestStageReached})
        </button>
      </div>

      {tab === 'divers' && (
        <div className="py-3 border-b border-slate-800/80 shrink-0">
          <label
            htmlFor="diver-callsign"
            className="block text-xs font-medium text-slate-400 mb-1.5"
          >
            Active Diver Callsign
          </label>
          <input
            id="diver-callsign"
            type="text"
            maxLength={16}
            value={callsign}
            onChange={(e) => onChangeCallsign(e.target.value)}
            placeholder="DIVER-01"
            className="w-full h-10 px-3 rounded-lg bg-[#0B0D11] border border-slate-700/80 text-sm font-mono font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 pt-2">
        {tab === 'divers' ? (
          entries.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <p className="text-sm font-medium text-slate-300">
                No dives logged yet.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Clear stages to climb the standings by Best Stage, Total Clears,
                and Top Speed.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-medium text-slate-500 border-b border-slate-800/70">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 px-2 font-medium">Diver</th>
                  <th className="py-2 px-2 font-medium text-right">Best Stg</th>
                  <th className="py-2 px-2 font-medium text-right">Clears</th>
                  <th className="py-2 pl-2 font-medium text-right">Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {entries.slice(0, 20).map((entry, idx) => {
                  const isHighlighted =
                    highlightId === entry.id ||
                    entry.callsign.toLowerCase() ===
                      (callsign.trim() || 'DIVER-01').toLowerCase();
                  return (
                    <tr
                      key={entry.id}
                      className={
                        isHighlighted
                          ? 'bg-amber-500/10 text-amber-200'
                          : 'text-slate-200'
                      }
                    >
                      <td className="py-2.5 pr-2 font-mono text-xs tabular-nums text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-2 max-w-[115px] truncate font-medium">
                        {entry.callsign}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-bold tabular-nums text-right text-amber-400">
                        {entry.highestLevelCleared > 0
                          ? `S${entry.highestLevelCleared}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-xs tabular-nums text-right text-emerald-400">
                        {entry.totalClears}
                      </td>
                      <td className="py-2.5 pl-2 font-mono text-xs tabular-nums text-right text-slate-400">
                        {entry.bestSpeedKmh}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          <div className="divide-y divide-slate-800/50">
            {unlockedStages.map((stageNum) => {
              const stats = progress.stageStats[stageNum];
              const isCurrent = stageNum === currentStage;
              const clears =
                stats?.clears ?? (stageNum <= progress.bestStreak ? 1 : 0);
              const attempts = stats?.attempts ?? clears;
              const bestSpeed = stats?.bestSpeedKmh ?? 0;

              return (
                <div
                  key={stageNum}
                  className={`py-2.5 px-2 flex items-center justify-between gap-3 ${
                    isCurrent ? 'bg-amber-500/8 rounded-lg' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold uppercase text-white tabular-nums">
                        Stage {stageNum}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-bold uppercase text-amber-400">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400">
                      {clears > 0
                        ? `${clears} clear${clears === 1 ? '' : 's'} · ${attempts} tries`
                        : attempts > 0
                        ? `${attempts} failed ${attempts === 1 ? 'try' : 'tries'}`
                        : 'Frontier unlocked'}
                      {bestSpeed > 0 ? ` · ${bestSpeed} km/h` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectStage(stageNum)}
                    className="min-h-[38px] px-3 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-100 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Dive
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
