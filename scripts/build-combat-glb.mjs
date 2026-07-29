import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  };
}

function transformed(geometry, {
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
} = {}) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  const clone = geometry.clone();
  clone.applyMatrix4(matrix);
  clone.deleteAttribute('uv');
  return clone;
}

const hullParts = [
  transformed(new THREE.CylinderGeometry(2.7, 3.5, 20, 10, 1, false), { rotation: [Math.PI / 2, 0, 0] }),
  transformed(new THREE.ConeGeometry(2.75, 8.5, 10), { position: [0, 0, -13.5], rotation: [-Math.PI / 2, 0, 0] }),
  transformed(new THREE.BoxGeometry(1.45, 1.15, 19), { position: [0, 2.15, -0.8] }),
  transformed(new THREE.BoxGeometry(11.5, 0.75, 8.5), { position: [0, -0.25, 5.5], rotation: [0, 0, 0.02] }),
  transformed(new THREE.BoxGeometry(7.8, 0.55, 9.5), { position: [0, 0.1, -2.5] }),
  transformed(new THREE.CylinderGeometry(0.82, 1.05, 13, 8), { position: [0, 2.35, -8.5], rotation: [Math.PI / 2, 0, 0] }),
  ...[-1, 1].flatMap((side) => [
    transformed(new THREE.CylinderGeometry(1.25, 1.55, 7.5, 8), { position: [side * 4.4, 0, 9], rotation: [Math.PI / 2, 0, 0] }),
    transformed(new THREE.BoxGeometry(0.38, 4.5, 4.4), { position: [side * 4.55, 2.15, 9.7], rotation: [0, 0, side * 0.42] }),
  ]),
];
const hullGeometry = mergeGeometries(hullParts, false);
hullGeometry.computeVertexNormals();
hullGeometry.computeBoundingSphere();

const glowParts = [-1, 1].map((side) => transformed(
  new THREE.CylinderGeometry(1.02, 1.02, 0.22, 10),
  { position: [side * 4.4, 0, 12.82], rotation: [Math.PI / 2, 0, 0] },
));
const glowGeometry = mergeGeometries(glowParts, false);
glowGeometry.computeVertexNormals();

const root = new THREE.Group();
root.name = 'AFFLATUS_COMMAND_GLTF';
const hull = new THREE.Mesh(hullGeometry, new THREE.MeshStandardMaterial({
  name: 'ceramic_armour',
  color: 0x6f7d89,
  metalness: 0.82,
  roughness: 0.38,
}));
hull.name = 'CommandHull';
root.add(hull);
const engines = new THREE.Mesh(glowGeometry, new THREE.MeshStandardMaterial({
  name: 'drive_emissive',
  color: 0x9ae5ff,
  emissive: 0x3fcbff,
  emissiveIntensity: 4.2,
  metalness: 0.25,
  roughness: 0.22,
}));
engines.name = 'DriveGlow';
root.add(engines);

for (const [name, position] of [
  ['Muzzle_Main', [0, 2.35, -15.1]],
  ['Muzzle_CIWS_Port', [-2.25, 1.55, -4.8]],
  ['Muzzle_CIWS_Starboard', [2.25, 1.55, -4.8]],
  ['MissileBay', [0, -1.3, 1.5]],
]) {
  const anchor = new THREE.Object3D();
  anchor.name = name;
  anchor.position.set(...position);
  root.add(anchor);
}

const scene = new THREE.Scene();
scene.name = 'AFFLATUS_CIC_SHIP';
scene.add(root);

const exporter = new GLTFExporter();
const output = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  trs: false,
});
const target = resolve(process.argv[2] || 'public/assets/combat/afflatus-command.glb');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, new Uint8Array(output));
console.log(`wrote ${target} (${output.byteLength} bytes)`);
