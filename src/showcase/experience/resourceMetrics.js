export function measureSceneResources(scene, renderer, extraTextures = 0) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  let drawables = 0;
  let instances = 0;
  let triangles = 0;

  scene.traverse((object) => {
    if (!object.isMesh && !object.isPoints && !object.isLine) return;
    drawables += 1;
    if (object.geometry) geometries.add(object.geometry);
    const instanceCount = object.isInstancedMesh ? object.count : 1;
    instances += object.isInstancedMesh ? object.count : 0;
    const indexCount = object.geometry?.index?.count;
    const positionCount = object.geometry?.getAttribute?.('position')?.count || 0;
    if (object.isMesh) triangles += ((indexCount || positionCount) / 3) * instanceCount;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  return Object.freeze({
    drawCalls: renderer.info?.render?.calls || drawables,
    drawables,
    geometries: geometries.size,
    instances,
    materials: materials.size,
    textures: textures.size + Math.max(0, Number(extraTextures) || 0),
    triangles: Math.round(triangles),
  });
}
