# M16 — Cross-device, static journey and accessibility

## Result

The homepage now has a bounded mobile cinematic path and a complete no-WebGL route:

- Mobile High uses three shots only: bow approach, port-side parallel drift and engine pass/departure.
- Mobile DPR is capped at 1.20 (0.90 degraded), target 30 fps, dust is 8/24 of High, bloom is disabled and no depth-of-field pass exists.
- Static, Reduced Motion, Save-Data and unsupported-WebGL states are resolved before the deferred scene import.
- The static journey uses three art-directed AVIF frames and no motion crossfade in Reduced/Motion Off states.
- The visible header Motion switch persists the user preference and remains a 44px control.

## Static frame assets

The three frames were created with the built-in image-generation workflow in reference mode using `public/assets/showcase/signature-vanguard.jpg` for carrier identity:

1. `bow-approach.avif` — close bow approach from starboard-front, carrier cropped on the right, deep negative space for the left-side headline, near-black restrained cyan practical lights.
2. `parallel-drift.avif` — long port-side hull drift, readable window/aperture scale references, carrier kept away from the left text zone, no HUD or typography.
3. `engine-departure.avif` — rear engine/departure view, restrained cyan-white engines on the right, long dark wake and empty left field, bloom confined to engine emissives.

Mode: built-in Image Gen, reference-image edit/generation. Repository delivery is AVIF only; lossless workspace PNG intermediates were removed after browser verification.

## Accessibility contract

- Visible skip link targets the focusable `main` landmark.
- The decorative Canvas is `aria-hidden` and untabbable.
- Navigation, headings, status, route content and links remain complete without Canvas.
- Header and footer controls have explicit focus styles; persistent mobile controls are at least 44×44px.
- Command dialog keeps its focus trap and returns focus to the invoker.
- Native document navigation provides route focus semantics; no client-side router announcement is required.
- Reduced mode removes continuous and crossfade animation; 200% text sizing remains horizontally contained.

## Verification matrix

Browser evidence covers 390×844, 430×932, 768×1024 and 1440×1000; keyboard skip navigation; Motion preference persistence; Save-Data with zero `SignatureScene` requests; Reduced/static screenshots; and the localized semantic tree. Final command results are recorded in the M17 report.
