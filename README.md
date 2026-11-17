# Spike Plunge

A precision ragdoll descent game. Pick your launch angle and power, then tuck to survive a shaft lined with spikes. Use aerodynamic drag and currents to solve seeded courses; retries preserve the same route and airflow.

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
- During descent, hold A/D or Left/Right to rotate counterclockwise/clockwise. Touch has separate rotation buttons beside tuck. Rotation is capped at 60 degrees per second; release to hold the selected angle. Tucking never adds spin.
- R retries immediately after impact, during the death animation, or from the ready state. Aim is remembered per stage for this session.
- Scout shaft shows the complete wall layout before committing. Opening a modal pauses the simulation.

## Physics and difficulty

The flight model uses air-relative velocity, linear and speed-dependent drag, body orientation, and a smooth tuck transition. Tuck is compact and has low drag. Opening broadside brakes harder and catches more of a crosswind. Updrafts, downdrafts, dense-air chambers, and thin-air exits change the trajectory. Air acts at the mass centre; it never adds automatic spin. Rotation remains capped at 60 degrees/second, and release holds the selected angle. This is a tuned arcade aerodynamics model, not a fluid simulation.

Layers are fixed in space, with feathered edges. Their arrows, colours, survey bounds, and actual forces come from the same data. Waiting on the rim does not change the wind. The launch preview uses the same air integrator and assumes an open body; subsequent tuck and rotation input changes the path.

Each stage number produces a deterministic course. Twelve chamber families combine with independently selected exit currents, seeded gate counts and spacing, chamber widths, launch sides, and shaft bends. Later stages approach bounded difficulty; shafts stay between 820 and 1410 world pixels tall. There is no eight-stage geometry loop. The stage browser uses bounded pages rather than generating thousands of courses on every render.

Courses are constructed around a reference trajectory using the same digital rotation/tuck controls, body layout, pose transitions, and aerodynamic integrator as play. The constructor reserves clearance for the full articulated pose, node radii, and projected spike depth. The reference is construction/test data, not an in-game autopilot or a displayed solution. Representative seeds are additionally checked against the complete collision and landing solver.

Fast motion uses swept spike checks. A safe landing resolves the controlled body as a whole on the cushion, preventing artificial per-limb rebounds. Clearing still requires the torso to reach the pad alive, with all body nodes inside the pad for the confirmation interval. Contact never grants blanket spike immunity.

## Validation

```sh
npm run lint
npm run build
npm run test:flight
npm run test:playability
```

The playability suite checks 647 distinct courses: stages 1–512, seven large/boundary stage numbers, and 128 seeds scattered over the supported range. Every reference route must clear using the production solver, and default launches must fail both tucked and untucked. The first 128 and the large/scattered seeds must tolerate a 3×3 aim grid of ±0.5 degrees and ±0.5 percentage points of power, stance-switch shifts of ±2% of shaft depth, and body-angle target errors of ±3 degrees. These are reachability/tolerance checks, not estimated human win rates or an exhaustive proof over every stage number.

Tests also check varied geometry, cache isolation, stable landings, whether ignoring the reference pose changes affects outcomes, dissipative drag, pose-dependent braking, wind/updraft/downburst/density responses, timestep convergence, stable rotation, and swept collision detection. Browser checks cover manual crosswind/airbrake landings, readable surveys and airflow feedback, and narrow-screen layouts.

## Diver models

The nine cosmetic divers share the same collision body and handling. Models use outlined, shaded canvas shapes, layered front/back limbs, and species-specific paws, claws, feathers, flippers, and torso details. Bunny ears and shark fins fold closer during tuck; accessories are decorative.

The locker supports full-body upright, tucked, and sideways previews, including locked divers. Inspecting a locked diver does not unlock or equip it. Only unlocked divers can be equipped. The preview uses the production renderer and controlled-flight pose construction on an isolated character instance.
