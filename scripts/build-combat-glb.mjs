import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createAfflatusVanguard } from '../src/scene/afflatusVanguard.js';

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

const { group } = createAfflatusVanguard(THREE, {
  detail: 'full',
  forwardNegativeZ: true,
});
group.name = 'AFFLATUS_VANGUARD_COMMAND';

const scene = new THREE.Scene();
scene.name = 'AFFLATUS_CIC_SHIP';
scene.add(group);

const exporter = new GLTFExporter();
const output = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  trs: true,
});
const target = resolve(process.argv[2] || 'public/assets/combat/afflatus-command.glb');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, new Uint8Array(output));
console.log(`wrote ${target} (${output.byteLength} bytes)`);
