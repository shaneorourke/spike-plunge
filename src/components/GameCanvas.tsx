import { useEffect, useRef } from 'react';
import { soundEngine } from '../engine/audio';
import { generateLevel } from '../engine/levelGen';
import {
  createGoreWorld,
  createRagdollOnPlatform,
  getRagdollCenter,
  getRagdollSpeed,
  launchRagdoll,
  stepHazards,
  stepRagdollAndGore,
  type GoreWorld,
} from '../engine/ragdoll';
import { renderGame } from '../engine/renderer';
import type {
  CharacterId,
  GamePhase,
  InputState,
  LevelConfig,
  Ragdoll,
  RunTelemetry,
} from '../types/game';

interface GameCanvasProps {
  phase: GamePhase;
  characterId: CharacterId;
  levelNumber: number;
  runNonce?: number;
  levelsCleared: number;
  totalMetersRun: number;
  externalTuckRef: React.MutableRefObject<boolean>;
  triggerDiveRef: React.MutableRefObject<(() => void) | null>;
  onPhaseChange: (next: GamePhase) => void;
  onTelemetry: (t: RunTelemetry) => void;
  onLevelComplete: (clearedMeters: number, maxSpeedKmh: number) => void;
  onRunFailed: (
    cause: string,
    limbsLost: number,
    fallenMeters: number,
    maxSpeedKmh: number
  ) => void;
}

export function GameCanvas({
  phase,
  characterId,
  levelNumber,
  runNonce = 0,
  levelsCleared,
  totalMetersRun,
  externalTuckRef,
  triggerDiveRef,
  onPhaseChange,
  onTelemetry,
  onLevelComplete,
  onRunFailed,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const characterIdRef = useRef<CharacterId>(characterId);
  characterIdRef.current = characterId;

  const levelNumberRef = useRef(levelNumber);
  levelNumberRef.current = levelNumber;
  const levelsClearedRef = useRef(levelsCleared);
  levelsClearedRef.current = levelsCleared;
  const totalMetersRunRef = useRef(totalMetersRun);
  totalMetersRunRef.current = totalMetersRun;

  // Mutable simulation state kept out of React re-render cycle for 60fps smoothness
  const simRef = useRef<{
    level: LevelConfig;
    ragdoll: Ragdoll;
    gore: GoreWorld;
    cameraY: number;
    elapsed: number;
    pointerInput: {
      tuckPointers: Set<number>;
      aimPointerId: number | null;
      aimStartX: number;
      aimStartY: number;
    };
    keyInput: {
      tuck: boolean;
    };
    input: InputState;
    lastTelemetryAt: number;
    accumulator: number;
    fallTime: number;
    rimRestTime: number;
  } | null>(null);

  // Initialize or reset level ONLY when entering TITLE or READY (not when leaving READY -> FALLING!)
  useEffect(() => {
    if (phase !== 'TITLE' && phase !== 'READY') return;

    const lvl = generateLevel(levelNumber);
    const rag = createRagdollOnPlatform(lvl);
    const gore = createGoreWorld();

    simRef.current = {
      level: lvl,
      ragdoll: rag,
      gore,
      cameraY: lvl.platformY - 235,
      elapsed: 0,
      pointerInput: {
        tuckPointers: new Set(),
        aimPointerId: null,
        aimStartX: 0,
        aimStartY: 0,
      },
      keyInput: {
        tuck: false,
      },
      input: {
        tuck: false,
        aimActive: false,
        aimAngle:
          lvl.platformSide === 'left' ? -Math.PI * 0.72 : -Math.PI * 0.28,
        aimPower: 0.45,
      },
      lastTelemetryAt: 0,
      accumulator: 0,
      fallTime: 0,
      rimRestTime: 0,
    };

    const totalHeightMeters = Math.round((lvl.floorY - lvl.platformY) / 10);
    onTelemetry({
      level: levelNumber,
      levelsCleared,
      currentDepthMeters: 0,
      totalHeightMeters,
      progressRatio: 0,
      speedKmh: 0,
      maxSpeedKmh: 0,
      totalMetersRun,
      limbsLost: 0,
      tucking: false,
      windForce: 0,
      fatalCause: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelNumber, phase, runNonce]);

  // Expose instant dive trigger for thumb CTA button / Spacebar
  useEffect(() => {
    triggerDiveRef.current = () => {
      const sim = simRef.current;
      if (!sim || phaseRef.current !== 'READY') return;
      soundEngine.unlock();
      soundEngine.playJump();
      const angle = sim.input.aimAngle;
      const power = sim.input.aimPower;
      // Verlet solver uses 3 substeps per 60fps frame, so substep dt = 1/180
      launchRagdoll(
        sim.ragdoll,
        angle,
        power,
        sim.level.gravity,
        1 / 180,
        sim.gore
      );
      sim.input.aimActive = false;
      sim.fallTime = 0;
      sim.rimRestTime = 0;
      onPhaseChange('FALLING');
    };
  }, [onPhaseChange, triggerDiveRef]);

  // Keyboard controls (Space to jump, Space/S/Down to tuck mid-air)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const sim = simRef.current;
      if (!sim) return;

      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        sim.keyInput.tuck = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (phaseRef.current === 'READY') {
          triggerDiveRef.current?.();
        } else if (phaseRef.current === 'FALLING') {
          sim.keyInput.tuck = true;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (!sim) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') {
        sim.keyInput.tuck = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerDiveRef]);

  // Main 60fps animation & physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const rawDt = Math.min(0.033, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      if (sim) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssWidth = canvas.width / dpr;
        const cssHeight = canvas.height / dpr;

        // Merge keyboard + canvas touch + external tuck button
        sim.input.tuck =
          sim.keyInput.tuck ||
          sim.pointerInput.tuckPointers.size > 0 ||
          externalTuckRef.current;

        const FIXED_DT = 1 / 60;
        sim.accumulator = Math.min(0.1, sim.accumulator + rawDt);

        const curPhase = phaseRef.current;
        let currentWind = 0;
        let speedKmh = 0;

        while (sim.accumulator >= FIXED_DT) {
          sim.accumulator -= FIXED_DT;
          sim.elapsed += FIXED_DT;
          stepHazards(sim.level, sim.elapsed);

          if (curPhase === 'FALLING' || curPhase === 'DYING') {
            const res = stepRagdollAndGore(
              sim.ragdoll,
              sim.level,
              sim.input,
              sim.gore,
              FIXED_DT,
              sim.elapsed
            );
            currentWind = res.currentWind;
            speedKmh = getRagdollSpeed(sim.ragdoll, FIXED_DT) * 0.14;
          }
        }

        if (curPhase === 'FALLING' || curPhase === 'DYING') {
          if (speedKmh === 0) {
            speedKmh = getRagdollSpeed(sim.ragdoll, FIXED_DT) * 0.14;
          }

          soundEngine.updateWind(
            speedKmh / 140,
            curPhase === 'FALLING' && sim.ragdoll.alive
          );

          // Check fatal transition
          if (curPhase === 'FALLING' && !sim.ragdoll.alive) {
            onPhaseChange('DYING');
          }

          // If diver jumped away from the pit and settled back on the outer cliff rim,
          // reset cleanly back to READY so they can re-aim into the pit without soft-locking
          if (curPhase === 'FALLING' && sim.ragdoll.alive) {
            sim.fallTime += rawDt;
            const c = getRagdollCenter(sim.ragdoll);
            const onOuterRim =
              c.y <= sim.level.platformY - 2 &&
              (c.x < sim.level.topLeftX - 2 || c.x > sim.level.topRightX + 2);
            if (sim.fallTime > 0.4 && onOuterRim && speedKmh < 12) {
              sim.rimRestTime += rawDt;
              if (sim.rimRestTime >= 0.45) {
                soundEngine.updateWind(0, false);
                onPhaseChange('READY');
              }
            } else {
              sim.rimRestTime = 0;
            }
          }

          // Check level cleared on landing zone
          if (sim.ragdoll.alive && sim.ragdoll.landTimer >= 0.15) {
            soundEngine.updateWind(0, false);
            soundEngine.playLevelClear();
            const clearedMeters = Math.round(
              (sim.level.floorY - sim.level.platformY) / 10
            );
            onPhaseChange('LANDED');
            onLevelComplete(clearedMeters, Math.round(sim.ragdoll.maxSpeed));
          }

          // Check death cam completion -> Game Over
          if (!sim.ragdoll.alive && sim.ragdoll.deathTime >= 1.45) {
            soundEngine.updateWind(0, false);
            const center = getRagdollCenter(sim.ragdoll);
            const fallenMeters = Math.max(
              0,
              Math.round((center.y - sim.level.platformY) / 10)
            );
            onPhaseChange('GAME_OVER');
            onRunFailed(
              sim.ragdoll.fatalCause || 'Wall Spikes',
              sim.ragdoll.limbsLost,
              fallenMeters,
              Math.round(sim.ragdoll.maxSpeed)
            );
          }
        } else {
          soundEngine.updateWind(0, false);
        }

        // Smooth camera tracking
        const scale = cssWidth / sim.level.worldWidth;
        const viewWorldHeight = cssHeight / scale;
        const center = getRagdollCenter(sim.ragdoll);
        const targetCamY =
          curPhase === 'READY' || curPhase === 'TITLE'
            ? sim.level.platformY - 235
            : center.y - viewWorldHeight * 0.36;

        const maxCamY = Math.max(
          sim.level.platformY - 235,
          sim.level.floorY - viewWorldHeight + 76
        );
        const clampedTarget = Math.max(sim.level.platformY - 280, Math.min(maxCamY, targetCamY));
        sim.cameraY += (clampedTarget - sim.cameraY) * Math.min(1, rawDt * 8.5);

        // Render frame
        ctx.save();
        ctx.scale(dpr, dpr);
        renderGame({
          ctx,
          width: cssWidth,
          height: cssHeight,
          level: sim.level,
          ragdoll: sim.ragdoll,
          gore: sim.gore,
          phase: curPhase,
          characterId: characterIdRef.current,
          input: sim.input,
          cameraY: sim.cameraY,
          elapsedTime: sim.elapsed,
          speedKmh,
        });
        ctx.restore();

        // Throttle React HUD telemetry updates to ~15Hz
        if (now - sim.lastTelemetryAt > 65) {
          sim.lastTelemetryAt = now;
          const totalHeightMeters = Math.round(
            (sim.level.floorY - sim.level.platformY) / 10
          );
          const currentDepthMeters = Math.max(
            0,
            Math.min(
              totalHeightMeters,
              Math.round((center.y - sim.level.platformY) / 10)
            )
          );
          const progressRatio = Math.max(
            0,
            Math.min(
              1,
              (center.y - sim.level.platformY) /
                (sim.level.floorY - sim.level.platformY)
            )
          );

          onTelemetry({
            level: levelNumberRef.current,
            levelsCleared: levelsClearedRef.current,
            currentDepthMeters,
            totalHeightMeters,
            progressRatio,
            speedKmh: Math.round(speedKmh),
            maxSpeedKmh: Math.round(sim.ragdoll.maxSpeed),
            totalMetersRun: totalMetersRunRef.current,
            limbsLost: sim.ragdoll.limbsLost,
            tucking: sim.ragdoll.tucking,
            windForce: Math.round(currentWind),
            fatalCause: sim.ragdoll.fatalCause,
          });
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      soundEngine.updateWind(0, false);
    };
  }, [externalTuckRef, onLevelComplete, onPhaseChange, onRunFailed, onTelemetry]);

  // Pointer handlers on canvas for slingshot aiming (READY) and hold-to-tuck (FALLING)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.unlock();
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    if (phaseRef.current === 'READY') {
      sim.pointerInput.aimPointerId = e.pointerId;
      sim.pointerInput.aimStartX = relX;
      sim.pointerInput.aimStartY = relY;
      sim.input.aimActive = true;
      return;
    }

    if (phaseRef.current === 'FALLING') {
      sim.pointerInput.tuckPointers.add(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    if (
      phaseRef.current === 'READY' &&
      sim.pointerInput.aimPointerId === e.pointerId
    ) {
      const dx = relX - sim.pointerInput.aimStartX;
      const dy = relY - sim.pointerInput.aimStartY;
      const dragLen = Math.hypot(dx, dy);

      if (dragLen > 8) {
        // Slingshot: pull down/back to aim up & forward, or drag up/forward directly
        const aimDx = dy > 0 ? -dx : dx;
        const aimDy = dy > 0 ? -dy : dy;
        let angle = Math.atan2(aimDy, aimDx);

        // Strictly restrict to upward jump arcs (cannot aim down through platform)
        if (angle > 0) {
          angle = angle < Math.PI * 0.5 ? -0.22 : -Math.PI + 0.22;
        }
        angle = Math.max(-Math.PI + 0.22, Math.min(-0.22, angle));

        sim.input.aimAngle = angle;
        sim.input.aimPower = Math.max(0.15, Math.min(1, dragLen / 115));
      }
    }
  };

  const handlePointerUpOrCancel = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const sim = simRef.current;
    if (!sim) return;

    if (
      phaseRef.current === 'READY' &&
      sim.pointerInput.aimPointerId === e.pointerId
    ) {
      sim.pointerInput.aimPointerId = null;
      sim.input.aimActive = false;
      triggerDiveRef.current?.();
      return;
    }

    sim.pointerInput.tuckPointers.delete(e.pointerId);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      className="w-full h-full block touch-game-surface cursor-crosshair"
    />
  );
}
