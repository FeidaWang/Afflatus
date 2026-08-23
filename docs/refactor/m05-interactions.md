# AFFLATUS M05 — Interaction primitives handoff

Date: 2026-08-23
Scope: M05 only. M06 scene implementation has not started.

## Outcome

The M04 home now uses a small, reusable interaction vocabulary instead of route-local hover treatments:

- `CommandButton` owns Idle, Pointer Hover, Pointer Down, Release, Focus and Disabled states.
- `EditorialLink` uses an underline redraw and a 4px arrow displacement only.
- `TransmissionRow` preserves a flat row geometry: no scale, tilt or glow.
- `MotionToggle` exposes a persistent, accessible switch and defaults to the system motion preference when no override exists.
- `FocusBoundary` traps dialog focus, dismisses on Escape and restores the Command trigger.
- `useDisclosureMenu` centralizes the mobile menu disclosure/Escape contract.

## Interaction contract

### Command Button

- Stable outer button box; all visual displacement is applied to the inner surface with transforms.
- Magnetic displacement is enabled only for `pointer: fine`, only while Motion is on, and is clamped to 5px on each axis.
- Touch pointer events do not enter a hover state or write magnetic offsets.
- Keyboard focus resets offsets to `0px` and receives the immediate M02 3px focus ring.
- The scan light runs once per pointer entry (`animation-iteration-count: 1`); there is no idle or infinite scan loop.
- `data-interaction-state` and `data-scene-signal` expose inspectable state without coupling the component to a renderer.

### Scene boundary

`src/lib/sceneSignals.js` defines the renderer-neutral `afflatus:scene-signal` custom event and immutable intent payload. The Command Button emits `command:open`; components do not import Three.js, Canvas or `DeckScene`. A future scene can subscribe at the application boundary in M06 without changing the interaction component.

### Motion preference

- Storage schema: `afflatus:motion:v1` with compact `on` / `off` values.
- Priority: forced reduced experience, stored user choice, then system `prefers-reduced-motion`.
- `html[data-motion="off"]` disables authored transitions/animations and magnetic transforms.
- `?experience=reduced` locks the toggle off to preserve the M01 route-level guardrail.

## React review

Applied the Vercel React best-practices checklist after editing the JSX components:

- transient pointer coordinates are stored as refs/CSS properties rather than React state;
- initial storage reads use lazy state initialization and a versioned key;
- direct imports avoid a barrel module;
- dialog and menu global effects clean up listeners/classes and focus restoration;
- no inline component definitions or heavy renderer imports were introduced.

## Automated evidence

- Unit/component contract: `tests/m05InteractionPrimitives.test.js`
- Browser contract: `e2e/m05-interactions.spec.js`
- M01/M04 compatibility: `e2e/experience-mode.spec.js`, `e2e/m04-home.spec.js`
- Existing active-route Axe gate remains the accessibility authority.

Visual evidence:

- `docs/refactor/screenshots/m05-keyboard-focus-1440x1000.png`
- `docs/refactor/screenshots/m05-touch-412x892.png`
- `docs/refactor/screenshots/m05-reduced-motion-440x956.png`

The browser checks cover bounded movement, stable `getBoundingClientRect()` geometry, all dynamic Command states, focus trapping/restoration, touch offsets, reduced-mode locking and storage persistence across reload.

## Performance note

Compared with the M04 handoff build, the home interaction layer adds approximately 3.5kB minified CSS and 5.2kB minified JS before gzip. It adds no Three.js scene chunk, network dependency or continuous animation. Pointer movement performs two CSS custom-property writes and does not trigger React renders.

## M06 handoff boundary

M06 may subscribe to `afflatus:scene-signal` or receive `onCommandIntent`, but it must keep the Command Button renderer-neutral. The M05 motion flag is the single authored-motion gate for scene intent; capability and performance policy remain M06 concerns.
