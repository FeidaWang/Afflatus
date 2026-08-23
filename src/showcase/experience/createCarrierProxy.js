import { createAfflatusVanguard } from '../../scene/afflatusVanguard.js';

export const CARRIER_STATIC_TRANSFORM = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotation: Object.freeze([0, 0, 0]),
  scale: 1.18,
});

function countTriangles(root) {
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const indexCount = object.geometry.index?.count;
    const positionCount = object.geometry.getAttribute('position')?.count || 0;
    triangles += (indexCount || positionCount) / 3;
  });
  return Math.round(triangles);
}

export function createCarrierProxy(THREE, profile = 'high') {
  const detail = profile === 'high' ? 'full' : 'reduced';
  const carrier = createAfflatusVanguard(THREE, { detail });
  const { group, materials } = carrier;

  group.name = 'AFFLATUS_01_GUIDED_CARRIER';
  group.position.fromArray(CARRIER_STATIC_TRANSFORM.position);
  group.rotation.fromArray(CARRIER_STATIC_TRANSFORM.rotation);
  group.scale.setScalar(CARRIER_STATIC_TRANSFORM.scale);
  group.userData.flightInvariant = CARRIER_STATIC_TRANSFORM;

  materials.hull.color.setHex(0x172129);
  materials.hull.roughness = 0.62;
  materials.arm.color.setHex(0x090d12);
  materials.arm.roughness = 0.56;
  materials.dark.color.setHex(0x030609);
  materials.trim.color.setHex(0x3e5360);
  materials.trim.roughness = 0.42;
  materials.glass.color.setHex(0x071219);
  materials.glass.emissive.setHex(0x1d7996);
  materials.glass.emissiveIntensity = 0.26;
  materials.blue.color.setHex(0xd8f7ff);
  materials.blue.emissive.setHex(0x64d8f5);
  materials.blue.emissiveIntensity = 2.35;
  materials.amber.color.setHex(0xff8969);
  materials.amber.emissive.setHex(0xff6b4a);
  materials.amber.emissiveIntensity = 0.78;
  materials.red.color.setHex(0x24292d);
  materials.red.emissiveIntensity = 0;

  return Object.freeze({
    ...carrier,
    triangleCount: countTriangles(group),
  });
}
