import { useEffect, useRef } from 'react';
import { soundEngine } from '../engine/audio';
import { airAt, projectedArea } from '../engine/aerodynamics';
import { DEFAULT_AIM, clampAim, launchAngle, readAim, type AimSettings } from '../engine/aim';
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
  paused: boolean;
  aimControlRef: React.MutableRefObject<((aim: AimSettings) => void) | null>;
  onAimChange: (aim: AimSettings) => void;
  characterId: CharacterId;
  levelNumber: number;
  runNonce?: number;
  levelsCleared: number;
  totalMetersRun: number;
  externalTuckRef: React.MutableRefObject<boolean>;
  externalRotateRef: React.MutableRefObject<number>;
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
  paused,
  aimControlRef,
  onAimChange,
  characterId,
  levelNumber,
  runNonce = 0,
  levelsCleared,
  totalMetersRun,
  externalTuckRef,
  externalRotateRef,
  triggerDiveRef,
  onPhaseChange,
  onTelemetry,
  onLevelComplete,
  onRunFailed,
}: GameCanvasProps) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const aimMemory = useRef(new Map<number, AimSettings>());
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
      rotateLeft: boolean;
      rotateRight: boolean;
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
    const aim = aimMemory.current.get(levelNumber) ?? DEFAULT_AIM;
    onAimChange(aim);

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
        rotateLeft: false,
        rotateRight: false,
        tuck: false,
      },
      input: {
        tuck: false,
        aimActive: false,
        aimAngle: launchAngle(lvl, aim.elevation),
        aimPower: aim.power,
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

  const updateAim = (settings: AimSettings) => {
    const sim = simRef.current;
    if (!sim || phaseRef.current !== 'READY' || pausedRef.current) return;
    const aim = clampAim(settings);
    sim.input.aimAngle = launchAngle(sim.level, aim.elevation);
    sim.input.aimPower = aim.power;
    aimMemory.current.set(sim.level.level, aim);
    onAimChange(aim);
  };
  aimControlRef.current = updateAim;

  // Expose instant dive trigger for thumb CTA button / Spacebar
  useEffect(() => {
    triggerDiveRef.current = () => {
      const sim = simRef.current;
      if (!sim || phaseRef.current !== 'READY' || pausedRef.current) return;
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
      sim.elapsed = 0;
      sim.fallTime = 0;
      sim.rimRestTime = 0;
      phaseRef.current = 'FALLING';
      onPhaseChange('FALLING');
    };
  }, [onPhaseChange, triggerDiveRef]);

  // Keyboard controls (Space to jump, Space/S/Down to tuck mid-air)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLInputElement && e.target.type !== 'range')) return;
      if (e.target instanceof HTMLInputElement && e.code.startsWith('Arrow')) return;
      const sim = simRef.current;
      if (!sim || pausedRef.current) return;
      if (phaseRef.current === 'READY' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        const aim = readAim(sim.level, sim.input.aimAngle, sim.input.aimPower);
        const fine = e.shiftKey ? .25 : 1;
        if (e.code === 'ArrowUp') aim.elevation += fine;
        if (e.code === 'ArrowDown') aim.elevation -= fine;
        if (e.code === 'ArrowLeft') aim.power -= fine / 100;
        if (e.code === 'ArrowRight') aim.power += fine / 100;
        updateAim(aim);
        return;
      }

      if (phaseRef.current === 'FALLING') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault(); sim.keyInput.rotateLeft = true; return;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault(); sim.keyInput.rotateRight = true; return;
        }
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        sim.keyInput.tuck = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (phaseRef.current === 'READY') {
          triggerDiveRef.current?.();
          sim.keyInput.tuck = true;
        } else if (phaseRef.current === 'FALLING') {
          sim.keyInput.tuck = true;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (!sim) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') sim.keyInput.rotateLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') sim.keyInput.rotateRight = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') {
        sim.keyInput.tuck = false;
      }
    };

    const releaseControls = () => {
      const sim = simRef.current;
      if (!sim) return;
      sim.keyInput.tuck = false;
      sim.keyInput.rotateLeft = false;
      sim.keyInput.rotateRight = false;
      externalRotateRef.current = 0;
      sim.pointerInput.tuckPointers.clear();
      sim.pointerInput.aimPointerId = null;
      sim.input.aimActive = false;
      externalTuckRef.current = false;
    };
    window.addEventListener('blur', releaseControls);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('blur', releaseControls);
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
      const rawDt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
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

        const keyboardTurn = Number(sim.keyInput.rotateRight) - Number(sim.keyInput.rotateLeft);
        sim.input.rotate = keyboardTurn || externalRotateRef.current;

        const FIXED_DT = 1 / 60;
        const frozen = pausedRef.current || document.hidden;
        sim.accumulator = frozen ? 0 : Math.min(0.1, sim.accumulator + rawDt);

        const curPhase = phaseRef.current;
        let speedKmh = 0;

        while (sim.accumulator >= FIXED_DT) {
          sim.accumulator -= FIXED_DT;
          sim.elapsed += FIXED_DT;
          stepHazards(sim.level, sim.elapsed);

          if (!frozen && (curPhase === 'FALLING' || curPhase === 'DYING')) {
            stepRagdollAndGore(
              sim.ragdoll,
              sim.level,
              sim.input,
              sim.gore,
              FIXED_DT,
              sim.elapsed
            );
            speedKmh = getRagdollSpeed(sim.ragdoll, FIXED_DT) * 0.14;
          }
        }

        if (!frozen && (curPhase === 'FALLING' || curPhase === 'DYING')) {
          if (speedKmh === 0) {
            speedKmh = getRagdollSpeed(sim.ragdoll, FIXED_DT) * 0.14;
          }

          soundEngine.updateWind(
            speedKmh / 140,
            curPhase === 'FALLING' && sim.ragdoll.alive
          );

          // Check fatal transition
          if (curPhase === 'FALLING' && !sim.ragdoll.alive) {
            phaseRef.current = 'DYING';
            onPhaseChange('DYING');
            onRunFailed(
              sim.ragdoll.fatalCause || 'Wall Spikes', sim.ragdoll.limbsLost,
              Math.round(sim.ragdoll.impactDepth ?? 0), Math.round(sim.ragdoll.maxSpeed)
            );
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
            phaseRef.current = 'LANDED';
            onPhaseChange('LANDED');
            onLevelComplete(clearedMeters, Math.round(sim.ragdoll.maxSpeed));
          }

          // Check death cam completion -> Game Over
          if (!sim.ragdoll.alive && sim.ragdoll.deathTime >= 0.65) {
            soundEngine.updateWind(0, false);
            phaseRef.current = 'GAME_OVER';
            onPhaseChange('GAME_OVER');
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
          const reachedFloor = phaseRef.current === 'LANDED';
          const currentDepthMeters = reachedFloor ? totalHeightMeters : Math.max(
            0,
            Math.min(
              totalHeightMeters,
              Math.round((center.y - sim.level.platformY) / 10)
            )
          );
          const progressRatio = reachedFloor ? 1 : Math.max(
            0,
            Math.min(
              1,
              (center.y - sim.level.platformY) /
                (sim.level.floorY - sim.level.platformY)
            )
          );

          const air = airAt(sim.level, center.y);
          const mass = sim.ragdoll.nodes.reduce((sum,n) => sum+n.mass,0);
          const step = sim.ragdoll.previousSubDt ?? 1/180;
          const vx = sim.ragdoll.nodes.reduce((sum,n) => sum+(n.x-n.oldX)*n.mass,0)/mass/step;
          const vy = sim.ragdoll.nodes.reduce((sum,n) => sum+(n.y-n.oldY)*n.mass,0)/mass/step;
          const activeZones = sim.level.windZones.filter(z => center.y > z.yStart && center.y < z.yEnd);
          onTelemetry({
            verticalWind: air.velocityY,
            airLabel: activeZones.map(z=>z.label).join(' + ') || 'Still air',
            dragArea: projectedArea(sim.ragdoll.bodyAngle,sim.ragdoll.tuckAmount,vx-air.velocityX,vy-air.velocityY),
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
            windForce: Math.round(air.velocityX),
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
  }, [externalTuckRef, externalRotateRef, onLevelComplete, onPhaseChange, onRunFailed, onTelemetry]);

  // Pointer handlers on canvas for slingshot aiming (READY) and hold-to-tuck (FALLING)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.unlock();
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas || pausedRef.current) return;
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
    if (!sim || !canvas || pausedRef.current) return;

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
        // Upward flicks and pull-back gestures both set elevation and reach.
        // Launches always face the shaft; precision is the challenge.
        const elevation = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
        const power = dragLen / (rect.width / sim.level.worldWidth) / 115;
        updateAim({ elevation, power });
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
      if (e.type !== 'pointercancel') triggerDiveRef.current?.();
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
      aria-label="Spike Plunge playfield. Drag to aim, release to jump. Hold to tuck in flight."
      className="w-full h-full block touch-game-surface cursor-crosshair"
    />
  );
}
