import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  CAPITAL_ASSET_PROFILE,
  FIGHTER_ASSET_PROFILE,
  disposeCombatAsset,
  normalizeCombatAsset,
} from '../src/scene/combatAssetLoader.js';

describe('combat asset loader', () => {
  it('normalizes the fighter to Y-up, nose +Z, centred, and 8.2 units long', () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(
      new THREE.BoxGeometry(10, 2, 4),
      new THREE.MeshBasicMaterial(),
    ));
    const nose = new THREE.Object3D();
    nose.name = 'nose-marker';
    nose.position.x = -5;
    source.add(nose);
    const up = new THREE.Object3D();
    up.name = 'up-marker';
    up.position.y = 1;
    source.add(up);
    const camera = new THREE.PerspectiveCamera();
    camera.name = 'embedded-camera';
    source.add(camera);
    const light = new THREE.DirectionalLight();
    light.name = 'embedded-light';
    source.add(light);

    const { root, diagnostics } = normalizeCombatAsset(source);
    const bounds = new THREE.Box3().setFromObject(root);
    const centre = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const nosePosition = nose.getWorldPosition(new THREE.Vector3());
    const upPosition = up.getWorldPosition(new THREE.Vector3());

    expect(size.z).toBeCloseTo(8.2, 5);
    expect(centre.length()).toBeLessThan(1e-6);
    expect(nosePosition.z).toBeGreaterThan(0);
    expect(upPosition.y).toBeGreaterThan(0);
    expect(root.getObjectByName('embedded-camera')).toBeUndefined();
    expect(root.getObjectByName('embedded-light')).toBeUndefined();
    expect(diagnostics).toMatchObject({
      removedViewNodes: 2,
      normalizedLength: expect.closeTo(8.2, 5),
      up: '+y',
      forward: '+z',
    });
  });

  it('disposes unique glTF textures, materials, and geometries', () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = new THREE.BoxGeometry();
    const textureDispose = vi.spyOn(texture, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const root = new THREE.Group();
    root.add(new THREE.Mesh(geometry, material));
    root.add(new THREE.Mesh(geometry, material));

    disposeCombatAsset(root);

    expect(textureDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).toHaveBeenCalledOnce();
  });

  it('keeps an authored +Z capital-ship heading while applying its target length', () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 20),
      new THREE.MeshBasicMaterial(),
    ));
    const nose = new THREE.Object3D();
    nose.position.z = 10;
    source.add(nose);

    const { root, diagnostics } = normalizeCombatAsset(source, CAPITAL_ASSET_PROFILE);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());

    expect(size.z).toBeCloseTo(12.72, 5);
    expect(nose.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(0);
    expect(diagnostics.forward).toBe('+z');
  });

  it('returns an identity combat pivot so scene yaw and weapon anchors stay in normalized units', () => {
    const source = new THREE.Group();
    const offsetGeometry = new THREE.BoxGeometry(4_000, 2_000, 20_000);
    offsetGeometry.translate(0, 0, 1_000_000);
    source.add(new THREE.Mesh(offsetGeometry, new THREE.MeshBasicMaterial()));

    const { root } = normalizeCombatAsset(source, CAPITAL_ASSET_PROFILE);
    expect(root.position.length()).toBe(0);
    expect([root.rotation.x, root.rotation.y, root.rotation.z]).toEqual([0, 0, 0]);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);

    root.rotation.y = Math.PI;
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 1, 5.4);
    root.add(muzzle);
    root.updateMatrixWorld(true);

    const centre = new THREE.Box3().setFromObject(root.children[0]).getCenter(new THREE.Vector3());
    const muzzleWorld = muzzle.getWorldPosition(new THREE.Vector3());
    expect(centre.length()).toBeLessThan(1e-5);
    expect(muzzleWorld.z).toBeCloseTo(-5.4, 5);
  });

  it('wires the compressed model decoders and preserves licensed profiles', () => {
    const loaderSource = readFileSync(
      new URL('../src/scene/combatAssetLoader.js', import.meta.url),
      'utf8',
    );
    const fighterSource = readFileSync(
      new URL('../src/scene/fighter3D.js', import.meta.url),
      'utf8',
    );

    expect(loaderSource).toContain("setTranscoderPath('/vendor/basis/')");
    expect(loaderSource).toContain('.setKTX2Loader(ktx2Loader)');
    expect(loaderSource).toContain('.setMeshoptDecoder(MeshoptDecoder)');
    expect(FIGHTER_ASSET_PROFILE).toMatchObject({
      license: 'CC-BY-4.0',
      sourceForward: '-x',
      targetLength: 8.2,
    });
    expect(CAPITAL_ASSET_PROFILE).toMatchObject({
      license: 'CC-BY-4.0',
      sourceForward: '+z',
      targetLength: 12.72,
    });
    expect(fighterSource).toContain("qualityTier === 'low'");
    expect(fighterSource).toContain('pendingSwap');
    expect(fighterSource).toContain('getAssetStatus');
    expect(fighterSource).toContain('getDiagnostics');
  });
});
