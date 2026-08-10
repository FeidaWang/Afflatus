import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

function parseGlb(data) {
  expect(data.toString('ascii', 0, 4)).toBe('glTF');
  expect(data.readUInt32LE(4)).toBe(2);
  expect(data.readUInt32LE(8)).toBe(data.length);
  const jsonLength = data.readUInt32LE(12);
  expect(data.toString('ascii', 16, 20)).toBe('JSON');
  const jsonEnd = 20 + jsonLength;
  return {
    gltf: JSON.parse(data.toString('utf8', 20, jsonEnd).trim()),
    bin: data.subarray(jsonEnd + 8),
  };
}

describe('CIC capital asset', () => {
  it('keeps the readable Venator silhouette inside a cold-start budget', async () => {
    const data = await readFile(new URL(
      '../public/assets/combat/models/venator-class-star-destroyer-cic.glb',
      import.meta.url,
    ));
    const { gltf } = parseGlb(data);
    const sceneNodes = gltf.scenes[gltf.scene || 0].nodes.map((index) => gltf.nodes[index]);
    const names = sceneNodes.map((node) => node.name);
    const triangles = gltf.meshes.reduce((total, mesh) => total + mesh.primitives.reduce(
      (meshTotal, primitive) => meshTotal + gltf.accessors[primitive.indices].count / 3,
      0,
    ), 0);

    expect(data.length).toBeLessThan(3_000_000);
    expect(triangles).toBeGreaterThan(100_000);
    expect(triangles).toBeLessThan(110_000);
    expect(gltf.materials).toHaveLength(7);
    expect(gltf.textures).toHaveLength(18);
    expect(gltf.images).toHaveLength(18);
    expect(gltf.extensionsUsed || []).not.toContain('KHR_materials_specular');
    expect(names).toEqual(expect.arrayContaining([
      'venator_bridge_Venator Bridge_0',
      'Cube.345_emission_0',
      'engines_engines_0',
      'doors_doors_0',
      'venator_body_top_Venator Body Top_0',
      'venator_body_middle_venator body middle_0',
      'venator_body_bottom_venator body bottom_0',
    ]));
    expect(names.join(' ')).not.toMatch(/trench|greebles|turbolaser/i);
  });

  it('keeps the complete fighter silhouette while halving every CIC texture', async () => {
    const data = await readFile(new URL(
      '../public/assets/combat/models/fictional-6th-gen-fighter-cic.glb',
      import.meta.url,
    ));
    const { gltf, bin } = parseGlb(data);
    const triangles = gltf.meshes.reduce((total, mesh) => total + mesh.primitives.reduce(
      (meshTotal, primitive) => meshTotal + gltf.accessors[primitive.indices].count / 3,
      0,
    ), 0);

    expect(data.length).toBeLessThan(1_100_000);
    expect(triangles).toBe(43_169);
    expect(gltf.nodes).toHaveLength(39);
    expect(gltf.meshes).toHaveLength(5);
    expect(gltf.materials).toHaveLength(5);
    expect(gltf.textures).toHaveLength(16);
    expect(gltf.images).toHaveLength(16);
    expect(gltf.nodes.map((node) => node.name)).toEqual(expect.arrayContaining([
      'nozzle_L_U_01',
      'nozzle_R_U_03',
      'body_mate2_0',
      'body_mate4_0',
    ]));
    for (const image of gltf.images) {
      const view = gltf.bufferViews[image.bufferView];
      const offset = view.byteOffset || 0;
      expect(bin.readUInt32LE(offset + 20)).toBe(512);
      expect(bin.readUInt32LE(offset + 24)).toBe(512);
      expect(bin.readUInt32LE(offset + 40)).toBe(10);
    }
  });
});
