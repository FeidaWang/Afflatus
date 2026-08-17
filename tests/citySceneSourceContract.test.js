import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(import.meta.dirname, '../src/scene/cityScene.js'),
  'utf8',
);
const compatibilitySource = readFileSync(
  resolve(import.meta.dirname, '../src/scene/citySandbox.js'),
  'utf8',
);
const pageSource = readFileSync(
  resolve(import.meta.dirname, '../src/pages/cityView.js'),
  'utf8',
);

describe('City scene rendering source contract', () => {
  it('uses the source-neutral renderer API in production and keeps a thin legacy bridge', () => {
    expect(pageSource).toContain("import('../scene/cityScene.js')");
    expect(pageSource).toContain('createCitySceneRenderer({');
    expect(pageSource).toContain('renderPlan: plan');
    expect(pageSource).not.toContain("import('../scene/citySandbox.js')");
    expect(compatibilitySource).toContain("from './cityScene.js'");
    expect(compatibilitySource).toContain('return createCitySceneRenderer({ ...rest, renderPlan });');
  });

  it('reuses fixed-capacity dynamic line attributes instead of replacing them per day', () => {
    expect(source.match(/createDynamicLineGeometry\(/g)?.length).toBe(6);
    expect(source).toContain('position.addUpdateRange(0, positions.length)');
    expect(source).not.toMatch(/setAttribute\('position',\s*new THREE\.Float32BufferAttribute\(linePositions/);
  });

  it('reuses instance transform scratch objects on the render hot path', () => {
    const setInstanceBody = source.match(/function setInstance[\s\S]*?\n}/)?.[0] ?? '';
    expect(setInstanceBody).toContain('INSTANCE_MATRIX.compose');
    expect(setInstanceBody).not.toContain('new THREE.');
  });

  it('lets the shared coordinator decide whether the first frame loop starts', () => {
    expect(source).toContain('if (resumeRequested) start();');
    expect(source).toContain('onResume: () => {');
    expect(source).toContain('onPause: () => {');
    expect(source).not.toMatch(/announceDay\(true\);\s*start\(\);/);
  });

  it('keeps lifecycle callbacks bound to outer start, stop and resize functions', () => {
    expect(source).toContain('let start = () => {};');
    expect(source).toContain('let resize = () => {};');
    expect(source).toContain('onLost: stop');
    expect(source).toContain('onRestore: () => {');
    expect(source).toContain("canvas.dataset.renderer = 'restoring'");
    expect(source.match(/restoreRaf = requestAnimationFrame/g)?.length).toBe(2);
    expect(source).toContain('resize = () => {');
    expect(source).not.toContain('function resize()');
  });

  it('does not render into the asynchronous context-loss interval', () => {
    expect(source).toContain('if (gl.isContextLost())');
    expect(source).toContain('if (gl.isContextLost() || lifecycle.getState().fallback)');
    expect(source).toMatch(/try \{\s*renderer\.render\(scene, camera\);/);
  });

  it('rolls back the entire renderer initialization transaction on failure', () => {
    expect(source).toMatch(/let scene = null;[\s\S]*try \{[\s\S]*new THREE\.WebGLRenderer/);
    expect(source).toMatch(/catch \(error\) \{[\s\S]*budgetSurface\?\.dispose\(\);[\s\S]*lifecycle\.dispose\(\);[\s\S]*disposeThreeScene\(scene, renderer\);[\s\S]*throw error;/);
    expect(source).toContain("canvas.removeEventListener('pointerdown', onTourPointerDown, { capture: true })");
  });

  it('renders hero landmarks through skeleton, slab, shell and roof proxies', () => {
    expect(source).toContain('const heroSkeletons = new THREE.InstancedMesh');
    expect(source).toContain('const heroSlabs = new THREE.InstancedMesh');
    expect(source).toContain('const heroRoofs = new THREE.InstancedMesh');
    expect(source).toContain("state.phase === 'skeleton' || state.phase === 'slabs'");
    expect(source).toContain("state.phase === 'roof' || state.phase === 'complete'");
    expect(source).toContain('heroSkeletons.count = heroSkeletonCursor');
    expect(source).toContain('heroSlabs.count = heroSlabCursor');
  });

  it('batches deterministic rooftop details and merges their outlines', () => {
    expect(source).toContain('const rooftopDetails = new THREE.InstancedMesh');
    expect(source).toContain('rooftopDetails.count = rooftopAssetCursor');
    expect(source).toContain('rooftopDetails.setColorAt(rooftopAssetCursor');
    expect(source).toContain('asset.position.x,\n              baseY,');
    expect(source).not.toContain('new THREE.Mesh(asset.geometry');
  });

  it('batches park furniture with one fill batch and one merged outline', () => {
    expect(source).toContain('const leisureMesh = new THREE.InstancedMesh');
    expect(source).toContain('leisureMesh.count = visibleLeisureAssetCount');
    expect(source).toContain('updateDynamicLineGeometry(leisureOutlineGeometry, linePositions)');
    expect(source).not.toContain('new THREE.Mesh(bench');
  });

  it('does not spend a draw call on an empty ridge for non-Hong Kong profiles', () => {
    expect(source).toContain(
      'const landscapeMeshes = Object.freeze([treeTrunks, treeCrowns, leisureMesh]);',
    );
    expect(source).toContain(
      'ridgeMesh.visible = assetVisibility.landscape && ridgePeakCount > 0;',
    );
  });

  it('keeps city-wide dynamic instance batches out of stale day-zero frustum bounds', () => {
    expect(source).toContain('roadMesh.frustumCulled = false');
    expect(source).toContain('boxShells, cylinderShells, skeletons, slabs');
    expect(source).toMatch(/for \(const mesh of \[boxShells[\s\S]*?mesh\.frustumCulled = false;/);
    expect(source).toContain('facadeStrips.frustumCulled = false');
    expect(source).toMatch(/const mesh = new THREE\.InstancedMesh\(heroGeometries[\s\S]*?mesh\.frustumCulled = false;/);
    expect(source).toContain('treeTrunks.frustumCulled = false');
    expect(source).toContain('vehicleMesh.frustumCulled = false');
    expect(source).toMatch(/for \(const mesh of Object\.values\(craneMeshes\)\)[\s\S]*?mesh\.frustumCulled = false;/);
  });

  it('batches repeated helicopter parts instead of spending one draw call per blade or skid', () => {
    expect(source).toContain('const helicopterOrangeParts = new THREE.InstancedMesh');
    expect(source).toContain('const mainRotorBlades = new THREE.InstancedMesh');
    expect(source).toContain('const tailRotorBlades = new THREE.InstancedMesh');
    expect(source).toContain('const helicopterSkids = new THREE.InstancedMesh');
    expect(source).not.toContain('const mainRotorBladeX = new THREE.Mesh');
    expect(source).not.toContain('const runner = new THREE.Mesh');
  });
});
