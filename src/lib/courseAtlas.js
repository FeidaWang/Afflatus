const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const smoothstep = (start, end, value) => {
  const t = clamp01((value - start) / Math.max(0.0001, end - start));
  return t * t * (3 - 2 * t);
};

/**
 * A reversible, window-scroll-driven scene. Nothing here consumes wheel input:
 * scrolling down opens the atlas and scrolling back up restores its title.
 */
export function atlasSceneState(scrollY, sectionTop, sectionHeight, viewportHeight) {
  const travel = Math.max(1, sectionHeight - viewportHeight);
  const progress = clamp01((scrollY - sectionTop) / travel);
  const mapReveal = smoothstep(0.12, 0.48, progress);
  return {
    progress,
    titleOpacity: 1 - smoothstep(0.05, 0.3, progress),
    mapOpacity: mapReveal,
    mapScale: 0.9 + mapReveal * 0.1,
    splitProgress: smoothstep(0.03, 0.46, progress),
    active: mapReveal > 0.32,
  };
}

export const atlasRelations = Object.freeze([
  ['02', '33', 'value'],
  ['04', '36', 'transfer'],
  ['05', '31', 'governance'],
  ['10', '21', 'runtime'],
  ['11', '27', 'reliability'],
  ['12', '25', 'evidence'],
  ['15', '20', 'state'],
  ['17', '24', 'security'],
  ['18', '31', 'authorization'],
  ['19', '23', 'trust'],
  ['20', '35', 'recovery'],
  ['22', '29', 'orchestration'],
  ['25', '34', 'pilot'],
  ['28', '32', 'requirements'],
  ['33', '34', 'economics'],
  ['35', '36', 'learning'],
]);
