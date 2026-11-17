import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronDown,
  Layers,
  RotateCcw,
  RotateCw,
  Skull,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CharacterSelectModal } from './components/CharacterSelectModal';
import { MIN_ELEVATION, MAX_ELEVATION, MIN_POWER, MAX_POWER, DEFAULT_AIM, type AimSettings } from './engine/aim';
import { LevelScout } from './components/LevelScout';
import { GameCanvas } from './components/GameCanvas';
import { LeaderboardView } from './components/LeaderboardView';
import { LevelSelectModal } from './components/LevelSelectModal';
import {
  CHARACTERS,
  getCharacterById,
  loadPlayerProgress,
  recordClearedJumpProgress,
  recordFailedStageAttempt,
  resetPlayerProgress,
  selectUnlockedCharacter,
} from './data/characters';
import { soundEngine } from './engine/audio';
import { generateLevel } from './engine/levelGen';
import type {
  CharacterDef,
  CharacterId,
  GamePhase,
  LeaderboardEntry,
  PlayerProgress,
  RunTelemetry,
} from './types/game';
import {
  clearLeaderboard,
  getSavedCallsign,
  loadLeaderboard,
  recordStageClearOnLeaderboard,
  recordStageFailureOnLeaderboard,
  saveCallsign,
} from './utils/leaderboard';

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(() =>
    loadPlayerProgress()
  );
  const [aim, setAim] = useState<AimSettings>(DEFAULT_AIM);
  const [scoutOpen, setScoutOpen] = useState(false);
  const aimControlRef = useRef<((aim: AimSettings) => void) | null>(null);
  const [phase, setPhase] = useState<GamePhase>('TITLE');
  const [levelNumber, setLevelNumber] = useState<number>(
    () => loadPlayerProgress().highestStageReached
  );
  const [runNonce, setRunNonce] = useState<number>(0);
  const [sessionClears, setSessionClears] = useState<number>(0);
  const [totalMetersRun, setTotalMetersRun] = useState<number>(0);

  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [callsign, setCallsign] = useState<string>(() => getSavedCallsign());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    loadLeaderboard()
  );
  const [mobileBoardOpen, setMobileBoardOpen] = useState<boolean>(false);
  const [lockerOpen, setLockerOpen] = useState<boolean>(false);
  const [stageSelectOpen, setStageSelectOpen] = useState<boolean>(false);
  const [confirmTitleReset, setConfirmTitleReset] = useState<boolean>(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<CharacterDef[]>([]);
  const [lastRecordMeta, setLastRecordMeta] = useState<{
    entryId: string | null;
    rank: number | null;
    isNewBest: boolean;
  }>({ entryId: null, rank: null, isNewBest: false });

  const [lastSummary, setLastSummary] = useState<{
    cause: string;
    limbsLost: number;
    fallenMeters: number;
    maxSpeedKmh: number;
    clearedMeters?: number;
  } | null>(null);

  const [telemetry, setTelemetry] = useState<RunTelemetry>({
    level: levelNumber,
    levelsCleared: 0,
    currentDepthMeters: 0,
    totalHeightMeters: 108,
    progressRatio: 0,
    speedKmh: 0,
    maxSpeedKmh: 0,
    totalMetersRun: 0,
    limbsLost: 0,
    diving: false,
    windForce: 0,
    fatalCause: null,
  });

  // Shared ref for bottom thumb-zone dive button
  const rotateRef = useRef(0);
  const diveRef = useRef<boolean>(false);
  const [diveActive, setDiveActive] = useState<boolean>(false);
  const triggerDiveRef = useRef<(() => void) | null>(null);

  const levelMeta = useMemo(() => generateLevel(levelNumber), [levelNumber]);
  const bestStageCleared = progress.bestStreak;
  const activeCharacter = useMemo(
    () => getCharacterById(progress.selectedCharacter),
    [progress.selectedCharacter]
  );

  const setDiveFlag = (val: boolean) => {
    diveRef.current = val;
    setDiveActive(val);
  };

  const resetThumbFlags = () => {
    rotateRef.current = 0;
    diveRef.current = false;
    setDiveActive(false);
  };

  useEffect(() => {
    const release = () => {
      rotateRef.current = 0;
      diveRef.current = false;
      setDiveActive(false);
    };
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, []);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
    if (!next) {
      soundEngine.unlock();
    }
  };

  const handleCallsignChange = (val: string) => {
    const saved = saveCallsign(val);
    setCallsign(val);
    if (val.trim().length > 0) {
      saveCallsign(saved);
    }
  };

  const handleSelectCharacter = (id: CharacterId) => {
    setProgress((prev) => selectUnlockedCharacter(prev, id));
  };

  const handleResetEverything = useCallback(() => {
    resetThumbFlags();
    const fresh = resetPlayerProgress();
    setProgress(fresh);
    setLeaderboard(clearLeaderboard());
    setLevelNumber(1);
    setSessionClears(0);
    setTotalMetersRun(0);
    setLastSummary(null);
    setNewlyUnlocked([]);
    setLastRecordMeta({ entryId: null, rank: null, isNewBest: false });
    setConfirmTitleReset(false);
    setStageSelectOpen(false);
    setLockerOpen(false);
    setMobileBoardOpen(false);
    setRunNonce((n) => n + 1);
    setPhase('TITLE');
  }, []);

  const handleStartFromTitle = useCallback(() => {
    soundEngine.unlock();
    resetThumbFlags();
    setLastSummary(null);
    setNewlyUnlocked([]);
    setRunNonce((n) => n + 1);
    setPhase('READY');
  }, []);

  const handleRetryStage = useCallback(() => {
    soundEngine.unlock();
    resetThumbFlags();
    setLastSummary(null);
    setNewlyUnlocked([]);
    setRunNonce((n) => n + 1);
    setPhase('READY');
  }, []);

  const handleNextLevel = useCallback(() => {
    soundEngine.unlock();
    resetThumbFlags();
    setNewlyUnlocked([]);
    setLevelNumber((n) => n + 1);
    setRunNonce((n) => n + 1);
    setPhase('READY');
  }, []);

  const handleSelectStage = useCallback(
    (stage: number) => {
      soundEngine.unlock();
      resetThumbFlags();
      const clamped = Math.max(
        1,
        Math.min(stage, progress.highestStageReached)
      );
      setLevelNumber(clamped);
      setLastSummary(null);
      setNewlyUnlocked([]);
      setRunNonce((n) => n + 1);
      setMobileBoardOpen(false);
      setStageSelectOpen(false);
      setPhase('READY');
    },
    [progress.highestStageReached]
  );

  const handleLevelComplete = useCallback(
    (clearedMeters: number, maxSpeedKmh: number) => {
      resetThumbFlags();
      setSessionClears((c) => c + 1);
      setTotalMetersRun((m) => m + clearedMeters);
      setLastSummary({
        cause: '',
        limbsLost: 0,
        fallenMeters: clearedMeters,
        maxSpeedKmh,
        clearedMeters,
      });

      setProgress((prev) => {
        const res = recordClearedJumpProgress(prev, levelNumber, maxSpeedKmh);
        if (res.newlyUnlocked.length > 0) {
          setNewlyUnlocked(res.newlyUnlocked);
        }
        return res.nextProgress;
      });

      const lb = recordStageClearOnLeaderboard({
        callsign: saveCallsign(callsign),
        clearedStage: levelNumber,
        clearedMeters,
        maxSpeedKmh,
      });
      setLeaderboard(lb.entries);
      setLastRecordMeta({
        entryId: lb.entryId,
        rank: lb.rank,
        isNewBest: lb.isNewBestStage,
      });
    },
    [callsign, levelNumber]
  );

  const handleRunFailed = useCallback(
    (
      cause: string,
      limbsLost: number,
      fallenMeters: number,
      maxSpeedKmh: number
    ) => {
      resetThumbFlags();
      setTotalMetersRun((m) => m + fallenMeters);
      setLastSummary({
        cause,
        limbsLost,
        fallenMeters,
        maxSpeedKmh,
      });

      setProgress((prev) => recordFailedStageAttempt(prev, levelNumber));

      const lb = recordStageFailureOnLeaderboard({
        callsign: saveCallsign(callsign),
        stageNumber: levelNumber,
        fallenMeters,
        maxSpeedKmh,
        limbsLost,
      });
      setLeaderboard(lb.entries);
      setLastRecordMeta({
        entryId: lb.entryId,
        rank: lb.rank,
        isNewBest: false,
      });
    },
    [callsign, levelNumber]
  );

  // Keyboard shortcuts for Next Stage / Retry Stage
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== 'range') ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.repeat || mobileBoardOpen || lockerOpen || stageSelectOpen || scoutOpen) return;
      if (e.code === 'KeyR' && (phase === 'DYING' || phase === 'GAME_OVER' || phase === 'READY')) {
        e.preventDefault();
        handleRetryStage();
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (phase === 'TITLE') {
          e.preventDefault();
          handleStartFromTitle();
        } else if (phase === 'LANDED') {
          e.preventDefault();
          handleNextLevel();
        } else if (phase === 'GAME_OVER') {
          e.preventDefault();
          handleRetryStage();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNextLevel, handleRetryStage, handleStartFromTitle, phase, mobileBoardOpen, lockerOpen, stageSelectOpen, scoutOpen]);

  return (
    <div className="h-[100dvh] w-full bg-[#0B0D11] text-slate-100 overflow-hidden lg:py-4 lg:px-6">
      <div className="h-full w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(380px,460px)_1fr] lg:gap-6">
        {/* PRIMARY SHAFT COLUMN */}
        <section className="relative flex flex-col h-full min-h-0 bg-[#0E1117] lg:border lg:border-slate-800/90 lg:rounded-xl overflow-hidden">
          {/* Compact Top HUD (< 8% mobile viewport height) */}
          <header className="h-12 shrink-0 px-3 flex items-center justify-between gap-2 bg-[#11151D] border-b border-slate-800/80 z-20">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display text-lg font-extrabold tracking-wide text-slate-100 uppercase whitespace-nowrap">
                Spike Plunge
              </span>
              <button
                type="button"
                onClick={() => setStageSelectOpen(true)}
                aria-label="Open stage selector"
                className="min-h-[40px] px-2 flex items-center gap-1 rounded-md hover:bg-slate-800/80 font-mono text-xs font-bold tabular-nums text-amber-400 whitespace-nowrap transition-colors"
              >
                <span>STG {levelNumber}</span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400/80" />
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300 shrink-0">
              <span className="whitespace-nowrap">
                {telemetry.currentDepthMeters}/{telemetry.totalHeightMeters}m
              </span>
              <span className="hidden sm:inline text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline whitespace-nowrap text-slate-400">
                {telemetry.speedKmh} km/h
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setLockerOpen(true)}
                aria-label="Choose character"
                className="min-h-[44px] px-2 flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-xs font-medium whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">{activeCharacter.name}</span>
              </button>
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="min-h-[44px] min-w-[40px] flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-slate-200" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileBoardOpen(true)}
                aria-label="Open leaderboard"
                className="lg:hidden min-h-[44px] min-w-[40px] flex items-center justify-center text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Trophy className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Main Interactive Shaft Viewport */}
          <div className="relative flex-1 min-h-0">
            <GameCanvas
              phase={phase}
              paused={mobileBoardOpen || lockerOpen || stageSelectOpen || scoutOpen}
              aimControlRef={aimControlRef}
              onAimChange={setAim}
              characterId={progress.selectedCharacter}
              levelNumber={levelNumber}
              runNonce={runNonce}
              levelsCleared={progress.totalJumpsCleared}
              totalMetersRun={totalMetersRun}
              externalDiveRef={diveRef}
              externalRotateRef={rotateRef}
              triggerDiveRef={triggerDiveRef}
              onPhaseChange={setPhase}
              onTelemetry={setTelemetry}
              onLevelComplete={handleLevelComplete}
              onRunFailed={handleRunFailed}
            />

            {/* Sub-header subtle shaft info */}
            {phase !== 'TITLE' && phase !== 'READY' && (
              <div className="pointer-events-none absolute top-2.5 left-3 right-6 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span className="truncate">
                  {levelMeta.difficultyLabel}
                  {bestStageCleared > 0
                    ? ` · Best Stage ${bestStageCleared}`
                    : ''}
                </span>
              </div>
            )}

            {phase === 'READY' && <>
              {scoutOpen && <LevelScout level={levelMeta} />}
              {scoutOpen && <button type="button" onClick={() => setScoutOpen(false)}
                className="absolute top-3 right-3 z-30 min-h-10 px-3 rounded-lg border border-cyan-500/40 bg-[#11151D]/95 text-cyan-300 text-xs font-bold">
                Close survey
              </button>}
              {!scoutOpen && <div className="absolute top-3 left-3 right-3 rounded-xl border border-slate-700 bg-[#0e141f]/95 p-3 z-10">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-200">{levelMeta.difficultyLabel}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5"><span className="text-red-400">{levelMeta.tier}</span> · Attempt {(progress.stageStats[levelNumber]?.attempts ?? 0) + 1}</p>
                  </div>
                  <button type="button" onClick={() => setScoutOpen(true)}
                    className="shrink-0 min-h-9 px-2.5 rounded-lg border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-950/40">
                    Scout shaft
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-xs text-slate-300">Elevation <strong className="float-right text-amber-400 font-mono">{aim.elevation.toFixed(2)}°</strong>
                    <input aria-label="Launch elevation" type="range" min={MIN_ELEVATION} max={MAX_ELEVATION} step="0.25" value={aim.elevation}
                      onChange={e => aimControlRef.current?.({...aim, elevation: Number(e.target.value)})} className="w-full mt-2 accent-amber-400" />
                  </label>
                  <label className="text-xs text-slate-300">Power <strong className="float-right text-amber-400 font-mono">{(aim.power * 100).toFixed(1)}%</strong>
                    <input aria-label="Launch power" type="range" min={MIN_POWER*100} max={MAX_POWER*100} step="0.5" value={aim.power * 100}
                      onChange={e => aimControlRef.current?.({...aim, power: Number(e.target.value) / 100})} className="w-full mt-2 accent-amber-400" />
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Preview: open body · Dive and rotation change your flight</p>
              </div>}
            </>}

            {phase === 'FALLING' && <div className="pointer-events-none absolute top-10 left-3 right-3 flex justify-between gap-2 text-[10px] font-mono">
              <span className="rounded-md border border-cyan-800/70 bg-[#0b1420]/90 text-cyan-300 px-2 py-1.5">
                {telemetry.airLabel ?? 'Still air'} {Math.abs(telemetry.windForce) > 5 ? `${telemetry.windForce > 0 ? '→' : '←'} ${Math.abs(telemetry.windForce/10).toFixed(1)}m/s` : ''}
                {Math.abs(telemetry.verticalWind ?? 0) > 5 ? ` ${(telemetry.verticalWind ?? 0) > 0 ? '↓' : '↑'} ${Math.abs((telemetry.verticalWind ?? 0)/10).toFixed(1)}m/s` : ''}
              </span>
              <span className="rounded-md bg-[#0b1420]/90 text-amber-300 px-2 py-1.5">{telemetry.diving ? 'DIVING' : (telemetry.dragArea ?? .4) < .5 ? 'STREAMLINED' : (telemetry.dragArea ?? .4) > .95 ? 'AIRBRAKING' : 'OPEN'}</span>
            </div>}

            {/* TITLE OVERLAY */}
            {phase === 'TITLE' && (
              <div className="absolute inset-0 bg-[#0B0D11]/82 backdrop-blur-[2px] flex flex-col justify-center p-6 z-30">
                <div className="max-w-sm mx-auto w-full">
                  <p className="text-xs font-mono font-bold tracking-wider text-amber-500 uppercase mb-1.5">
                    Ragdoll Freefall Challenge
                  </p>
                  <h1 className="font-display text-5xl font-extrabold tracking-tight text-white uppercase leading-none mb-3">
                    Spike Plunge
                  </h1>
                  <p className="text-sm text-slate-300 leading-relaxed mb-5">
                    Aim into the shaft, then use your body as an airbrake.
                    Extend into a dive to cut through wind; open and turn broadside to slow
                    down or catch a current. Every stage has a distinct route
                    and airflow.
                  </p>

                  <div className="mb-5">
                    <label
                      htmlFor="title-callsign"
                      className="block text-xs font-medium text-slate-400 mb-1.5"
                    >
                      Diver Callsign
                    </label>
                    <input
                      id="title-callsign"
                      type="text"
                      maxLength={16}
                      value={callsign}
                      onChange={(e) => handleCallsignChange(e.target.value)}
                      placeholder="DIVER-01"
                      className="w-full h-11 px-3.5 rounded-lg bg-[#141923] border border-slate-700 text-sm font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums mb-5">
                    <span>
                      Best Stage: {bestStageCleared > 0 ? bestStageCleared : '—'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Total Clears: {progress.totalJumpsCleared}</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handleStartFromTitle}
                      className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display text-xl font-extrabold tracking-wide uppercase transition-all whitespace-nowrap"
                    >
                      {progress.highestStageReached > 1
                        ? `Continue · Stage ${levelNumber}`
                        : `Start Dive · ${activeCharacter.name}`}
                    </button>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setStageSelectOpen(true)}
                        className="min-h-[44px] px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Layers className="w-4 h-4 text-amber-400" />
                        Stages (1–{progress.highestStageReached})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLockerOpen(true)}
                        className="min-h-[44px] px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold transition-colors whitespace-nowrap"
                      >
                        Divers ({progress.unlockedIds.length}/
                        {CHARACTERS.length})
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileBoardOpen(true)}
                      className="lg:hidden w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      View Leaderboard
                    </button>

                    {(progress.highestStageReached > 1 ||
                      progress.totalJumpsCleared > 0 ||
                      progress.unlockedIds.length > 1 ||
                      leaderboard.length > 0) && (
                      <div className="pt-1">
                        {confirmTitleReset ? (
                          <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-700/50 flex items-center justify-between gap-2">
                            <span className="text-xs text-red-300 font-medium">
                              Wipe stages, unlocks &amp; scores?
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={handleResetEverything}
                                className="min-h-[36px] px-2.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmTitleReset(false)}
                                className="min-h-[36px] px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmTitleReset(true)}
                            className="w-full min-h-[40px] px-3 py-2 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/35 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset Progress &amp; Unlocks
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LEVEL CLEARED OVERLAY */}
            {phase === 'LANDED' && (
              <div className="absolute inset-0 bg-[#0B0D11]/75 backdrop-blur-[2px] flex flex-col justify-center p-6 z-30">
                <div className="max-w-xs mx-auto w-full bg-[#131822] border border-emerald-500/40 rounded-xl p-5 text-center">
                  <p className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Landing Confirmed
                  </p>
                  <h2 className="font-display text-4xl font-extrabold text-white uppercase leading-none mb-2">
                    Stage {levelNumber} Cleared
                  </h2>
                  {lastRecordMeta.isNewBest ? (
                    <p className="text-xs font-mono font-bold text-amber-400 mb-3">
                      New Top Stage Record · Rank #{lastRecordMeta.rank ?? 1}
                    </p>
                  ) : (
                    <p className="text-xs font-mono text-slate-400 mb-3">
                      Next up: Stage {levelNumber + 1}
                    </p>
                  )}

                  {newlyUnlocked.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/12 border border-amber-500/40 text-left">
                      <p className="text-[11px] font-mono font-bold uppercase text-amber-400">
                        New Diver Unlocked
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="font-display text-lg font-bold text-white uppercase">
                          {newlyUnlocked.map((c) => c.name).join(', ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCharacter(newlyUnlocked[0].id);
                            setNewlyUnlocked([]);
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap"
                        >
                          Equip
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-800 mb-5 text-left">
                    <div>
                      <div className="text-[11px] text-slate-400">Drop Depth</div>
                      <div className="font-mono text-lg font-bold tabular-nums text-white">
                        {lastSummary?.clearedMeters ?? telemetry.totalHeightMeters}m
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Top Speed</div>
                      <div className="font-mono text-lg font-bold tabular-nums text-amber-400">
                        {lastSummary?.maxSpeedKmh ?? telemetry.maxSpeedKmh} km/h
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleNextLevel}
                      className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-display text-xl font-extrabold tracking-wide uppercase transition-all whitespace-nowrap"
                    >
                      Next Stage · STG {levelNumber + 1}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageSelectOpen(true)}
                      className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap"
                    >
                      Stage Select (1–{progress.highestStageReached})
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GAME OVER OVERLAY */}
            {phase === 'GAME_OVER' && (
              <div className="absolute inset-0 bg-[#0B0D11]/80 backdrop-blur-[2px] flex flex-col justify-center p-6 z-30">
                <div className="max-w-xs mx-auto w-full bg-[#14171F] border border-red-600/45 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-red-500 mb-1">
                    <Skull className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider">
                      Impaled · {lastSummary?.cause ?? 'Wall Spikes'}
                    </span>
                  </div>
                  <h2 className="font-display text-4xl font-extrabold text-white uppercase leading-none mb-1">
                    Stage {levelNumber} Failed
                  </h2>
                  <p className="text-xs font-mono text-slate-400 mb-4">
                    Best Stage Cleared:{' '}
                    {bestStageCleared > 0 ? `Stage ${bestStageCleared}` : 'None yet'}
                    {lastRecordMeta.rank ? ` · Rank #${lastRecordMeta.rank}` : ''}
                  </p>

                  <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                    {lastSummary?.cause.includes('exposed')
                      ? 'An exposed limb caught the spikes. Enter your dive before the constriction; open in the wider air chambers.'
                      : lastSummary?.cause.includes(levelMeta.platformSide === 'left' ? 'Left' : 'Right')
                      ? 'Try more reach or catch the air stream for longer. Dive and body angle now change your trajectory.'
                      : 'Try less reach or catch less of the air stream. Compare your pose changes with the shaft survey.'}
                  </p>
                  <p className="text-[10px] font-mono text-cyan-400 mb-3">Aim remembered · R to retry instantly</p>
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 mb-5">
                    <div>
                      <div className="text-[11px] text-slate-400">Impact depth</div>
                      <div className="font-mono text-base font-bold tabular-nums text-white">
                        {lastSummary?.fallenMeters ?? 0}m
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Max Speed</div>
                      <div className="font-mono text-base font-bold tabular-nums text-amber-400">
                        {lastSummary?.maxSpeedKmh ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Severed</div>
                      <div className="font-mono text-base font-bold tabular-nums text-red-400">
                        {lastSummary?.limbsLost ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handleRetryStage}
                      className="w-full min-h-[48px] px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display text-xl font-extrabold tracking-wide uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry Stage {levelNumber}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStageSelectOpen(true)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Stages (1–{progress.highestStageReached})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLockerOpen(true)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        Divers ({progress.unlockedIds.length}/{CHARACTERS.length})
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMobileBoardOpen(true)}
                      className="lg:hidden w-full min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap"
                    >
                      Leaderboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Ergonomic Thumb-Zone Controls (< 8% mobile viewport height) */}
          <footer className="h-[68px] shrink-0 px-3 py-2 bg-[#11151D] border-t border-slate-800/80 flex items-center gap-2 z-20 touch-game-surface">
            {phase === 'READY' ? (
              <button
                type="button"
                onClick={() => scoutOpen ? setScoutOpen(false) : triggerDiveRef.current?.()}
                className="w-full h-full min-h-[48px] rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-display text-xl font-extrabold tracking-wide uppercase transition-all whitespace-nowrap"
              >
                {scoutOpen ? 'Return to launch' : 'Launch · Space'}
              </button>
            ) : phase === 'FALLING' ? (
              <>
                <button type="button" aria-label="Rotate counterclockwise" title="Rotate left · A / Left arrow"
                  onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); rotateRef.current = -1; }}
                  onPointerUp={() => { if (rotateRef.current === -1) rotateRef.current = 0; }}
                  onPointerCancel={() => { if (rotateRef.current === -1) rotateRef.current = 0; }}
                  className="h-full min-w-14 rounded-lg bg-slate-800 text-cyan-300 flex items-center justify-center select-none">
                  <RotateCcw className="w-6 h-6" />
                </button>
                <button type="button"
                  onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDiveFlag(true); }}
                  onPointerUp={() => setDiveFlag(false)} onPointerCancel={() => setDiveFlag(false)}
                  className={`flex-1 h-full min-h-[48px] rounded-lg font-display text-xl font-extrabold uppercase select-none ${diveActive || telemetry.diving ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 border border-amber-500/40 text-amber-400'}`}>
                  <ArrowDownToLine className="w-4 h-4 inline mr-1" /> Hold to dive
                </button>
                <button type="button" aria-label="Rotate clockwise" title="Rotate right · D / Right arrow"
                  onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); rotateRef.current = 1; }}
                  onPointerUp={() => { if (rotateRef.current === 1) rotateRef.current = 0; }}
                  onPointerCancel={() => { if (rotateRef.current === 1) rotateRef.current = 0; }}
                  className="h-full min-w-14 rounded-lg bg-slate-800 text-cyan-300 flex items-center justify-center select-none">
                  <RotateCw className="w-6 h-6" />
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between px-2 text-xs text-slate-400">
                <span>
                  {phase === 'DYING'
                    ? 'Fatal impact · R to retry now'
                    : phase === 'LANDED'
                    ? 'Safe touchdown'
                    : phase === 'GAME_OVER'
                    ? `Failed Stage ${levelNumber} — R or tap Retry`
                    : 'Tap Continue or Choose Stage'}
                </span>
                <span className="font-mono tabular-nums text-slate-300">
                  Clears: {progress.totalJumpsCleared}
                </span>
              </div>
            )}
          </footer>
        </section>

        {/* DESKTOP TELEMETRY & LEADERBOARD SIDEBAR */}
        <aside className="hidden lg:flex flex-col gap-5 h-full min-h-0">
          {/* Live Telemetry & Controls Card */}
          <div className="bg-[#11151D] border border-slate-800/90 rounded-xl p-5 shrink-0">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800/80">
              <div>
                <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-white">
                  Stage {levelNumber} · {levelMeta.difficultyLabel}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  ↑↓ elevation · ←→ power · Shift for fine aim · Space to launch.
                  In flight: A/D or ←→ rotate; release to hold the angle. Space/S dives. R retries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStageSelectOpen(true)}
                className="min-h-[38px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-mono font-bold uppercase tracking-wide flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                Stages (1–{progress.highestStageReached})
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 pt-4">
              <div>
                <div className="text-xs text-slate-400">Fall Depth</div>
                <div className="font-mono text-xl font-bold tabular-nums text-white mt-0.5">
                  {telemetry.currentDepthMeters}m
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Speed</div>
                <div className="font-mono text-xl font-bold tabular-nums text-amber-400 mt-0.5">
                  {telemetry.speedKmh} <span className="text-xs font-normal">km/h</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Session</div>
                <div className="font-mono text-xl font-bold tabular-nums text-slate-200 mt-0.5">
                  {sessionClears} <span className="text-xs font-normal">clears</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Limbs Lost</div>
                <div className="font-mono text-xl font-bold tabular-nums text-red-400 mt-0.5">
                  {telemetry.limbsLost}
                </div>
              </div>
            </div>
          </div>

          {/* Persistent Leaderboard & Stage Records */}
          <div className="flex-1 min-h-0 bg-[#11151D] border border-slate-800/90 rounded-xl p-5 flex flex-col">
            <LeaderboardView
              entries={leaderboard}
              progress={progress}
              currentStage={levelNumber}
              callsign={callsign}
              onChangeCallsign={handleCallsignChange}
              onClear={() => setLeaderboard(clearLeaderboard())}
              onSelectStage={handleSelectStage}
              highlightId={lastRecordMeta.entryId}
            />
          </div>
        </aside>
      </div>

      {/* MOBILE LEADERBOARD BOTTOM SHEET */}
      {mobileBoardOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setMobileBoardOpen(false)}
        >
          <div
            className="bg-[#11151D] border-t border-slate-700/80 rounded-t-2xl h-[80dvh] p-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />
            <div className="flex items-center justify-end mb-1 shrink-0">
              <button
                type="button"
                onClick={() => setMobileBoardOpen(false)}
                aria-label="Close leaderboard"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <LeaderboardView
                entries={leaderboard}
                progress={progress}
                currentStage={levelNumber}
                callsign={callsign}
                onChangeCallsign={handleCallsignChange}
                onClear={() => setLeaderboard(clearLeaderboard())}
                onSelectStage={handleSelectStage}
                highlightId={lastRecordMeta.entryId}
              />
            </div>
          </div>
        </div>
      )}

      {/* STAGE SELECTOR MODAL */}
      <LevelSelectModal
        open={stageSelectOpen}
        currentStage={levelNumber}
        progress={progress}
        onSelectStage={handleSelectStage}
        onResetAll={handleResetEverything}
        onClose={() => setStageSelectOpen(false)}
      />

      {/* CHARACTER LOCKER MODAL */}
      <CharacterSelectModal
        open={lockerOpen}
        progress={progress}
        onSelect={handleSelectCharacter}
        onResetAll={handleResetEverything}
        onClose={() => setLockerOpen(false)}
      />
    </div>
  );
}
