# Spike Plunge

A precision ragdoll descent game. Pick your launch angle and power, then tuck to survive a shaft lined with spikes. No air steering and no randomized gameplay geometry: retries reward learning the same route.

## Run

Use a current Node.js release compatible with Vite 8 (Node 22.12+).

```sh
npm ci
npm run dev
```

## Controls

- Drag on the playfield to set a launch and release to jump. Upward flicks and pull-back gestures both aim toward the shaft.
- For exact adjustments, use the elevation and power sliders. Away from a slider, Up/Down changes elevation and Left/Right changes power; hold Shift for finer adjustments.
- Space launches. Hold Space, S, Down, the playfield, or the tuck button during flight to tuck.
- R retries immediately after impact, during the death animation, or from the ready state. Aim is remembered per stage for this session.
- Scout shaft shows the complete wall layout before committing. Opening a modal pauses the simulation.

## Difficulty

Eight profiles introduce early pinches, offset exits, an hourglass, a double constriction, and late bottlenecks. Subsequent circuits approach a bounded difficulty ceiling instead of shrinking forever. Gravity and launch response stay constant. Tucking changes body shape and rotation, not centre-of-mass steering. The default launch deliberately lacks sufficient reach.

A clear requires the torso to reach the pad alive, with every node inside the pad for a confirmation interval. Floor contact by an isolated limb does not grant immunity. Failure feedback records the first impact side, body part, and depth; replaying the death animation does not add extra deaths.

## Validation

```sh
npm run lint
npm run build
npm run test:playability
```

The headless check uses the production physics solver. It searches 108 angle/power combinations on stages 1–64 and all eight route variants at the difficulty ceiling (993–1000). Each tested stage must have a route that also tolerates a local 3×3 grid of ±0.5 degrees and ±0.5 percentage points of power; an adaptive refinement locates the interior of narrower windows. Default launches must fail both tucked and untucked. Additional checks cover deterministic level geometry and the isolated-foot landing regression.

These are reachability checks, not estimated player win rates. Browser playtesting remains necessary for input feel and presentation.
