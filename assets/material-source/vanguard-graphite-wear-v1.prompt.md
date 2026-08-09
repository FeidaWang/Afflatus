# Vanguard graphite wear source

- Generator: built-in image generation tool
- Use case: `stylized-concept`
- Runtime outputs: `public/assets/combat/materials/vanguard-*.ktx2`

## Prompt

Create a square, perfectly seamless grayscale micro-surface height and wear
source for dark graphite-basalt spacecraft armour. Use extremely fine machined
metal grain, subtle ceramic stippling, sparse hairline scratches, restrained
abrasion flecks and tiny maintenance scuffs. Render it as an orthographic,
full-bleed, unlit and shadowless PBR authoring texture with neutral grayscale
and controlled low contrast. Keep uniform texel density and seamless opposite
edges. Do not include panel borders, rivets, bolts, symbols, labels, text,
logos, watermark, perspective, cast shadows, baked lighting, color tint,
large focal scratches, dramatic damage, rust, dirt clumps or obvious repeats.

The deterministic build script mirrors the source into a periodic tile,
derives tangent-space normal, packed ORM and detail-wear maps, generates the
full mip chain, and encodes Basis Universal KTX2 output.
