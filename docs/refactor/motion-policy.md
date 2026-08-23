# AFFLATUS motion policy

Motion is progressive enhancement. It may communicate scale, direction or system state, but it never carries unique content, navigation, status or instructions.

## Profiles

| Profile | Continuous WebGL | Target | DPR cap | Dust | Bloom | Journey |
|---|---|---:|---:|---:|---|---|
| High | yes | 60 fps | 1.50 | 100% | engines only | seven authored nodes |
| Medium | yes | 45 fps | 1.25 | 58% | none | seven authored nodes |
| Mobile | yes | 30 fps | 1.20 | ~35% | none | bow → side → engine |
| Static | no | n/a | n/a | none | none | three AVIF keyframes |
| Reduced / Save-Data | no | n/a | n/a | none | none | three AVIF keyframes, no crossfade motion |

There is no depth of field. High-profile bloom is selective and restricted to engine emissives. The governor reduces DPR, dust and then bloom after sustained slow frames; text and input never enter the degradation ladder.

## Preference and lifecycle

- The visible header Motion switch persists the user's choice.
- `prefers-reduced-motion: reduce` and Save-Data override cinematic initialization before the scene import.
- Reduced/static frames change only with chapter state; their opacity does not animate.
- The scene pauses while the document is hidden, tears down on page exit and falls back after unrecoverable context loss.
- No flashing pattern or unpausable decorative motion is permitted.

## Accessibility

The canvas is decorative and removed from the accessibility tree. Keyboard focus is never communicated by motion or color alone. Semantic headings, links, current status, route meaning and all Command information remain in DOM in every profile.
