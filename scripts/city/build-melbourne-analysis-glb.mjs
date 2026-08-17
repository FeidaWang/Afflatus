#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { MeshoptEncoder } from 'meshoptimizer';
import { ShapeUtils, Vector2 } from 'three';

const ROOT = resolve(import.meta.dirname, '../..');
const PACKAGE_ID = 'melbourne-flinders-federation-v1';
const PACKAGE_DIR = resolve(ROOT, 'data/city/candidates', PACKAGE_ID);
const MANIFEST_PATH = resolve(PACKAGE_DIR, 'manifest.json');
const INDEX_PATH = resolve(PACKAGE_DIR, 'entities-index.json');
const ASSET_BASE_URI = `/assets/city/packages/${PACKAGE_ID}`;
const MATERIALS = Object.freeze({
  terrain: { name: 'terrain-analysis', color: [0.68, 0.7, 0.68, 1] },
  buildings: { name: 'buildings-analysis', color: [0.88, 0.89, 0.87, 1] },
  roads: { name: 'roads-analysis', color: [0.18, 0.2, 0.2, 1] },
  pedestrian: { name: 'pedestrian-analysis', color: [0.1, 0.45, 0.46, 1] },
  water: { name: 'water-analysis', color: [0.09, 0.3, 0.46, 1] },
  trees: { name: 'trees-analysis', color: [0.18, 0.42, 0.24, 1] },
  control: { name: 'survey-control-analysis', color: [0.92, 0.48, 0.08, 1] },
});

const jsonBytes = (value, pretty = false) => Buffer.from(
  `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`,
);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const align4 = (value) => (value + 3) & ~3;
const round = (value, places = 3) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

function appendAligned(parts, bytes, cursor) {
  const offset = align4(cursor);
  if (offset > cursor) parts.push(Buffer.alloc(offset - cursor));
  parts.push(Buffer.from(bytes));
  return { offset, cursor: offset + bytes.byteLength };
}

function cleanRing(ring) {
  const points = ring.map(([x, z]) => new Vector2(x, z));
  if (points.length > 1 && points[0].equals(points.at(-1))) points.pop();
  return points;
}

function triangulatePolygon(rings) {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  const contour = cleanRing(rings[0]);
  const holes = rings.slice(1).map(cleanRing).filter((ring) => ring.length >= 3);
  if (contour.length < 3) return null;
  if (!ShapeUtils.isClockWise(contour)) contour.reverse();
  holes.forEach((hole) => {
    if (ShapeUtils.isClockWise(hole)) hole.reverse();
  });
  return {
    rings: [contour, ...holes],
    points: [...contour, ...holes],
    faces: ShapeUtils.triangulateShape(contour, holes),
  };
}

function primitive(layer, mode) {
  return { layer, mode, positions: [], indices: [], featureIds: [] };
}

function addVertex(target, position, featureId) {
  const index = target.positions.length / 3;
  target.positions.push(position[0], position[1], position[2]);
  target.featureIds.push(featureId);
  return index;
}

function addTriangle(target, left, middle, right) {
  target.indices.push(left, middle, right);
}

function addQuad(target, points, featureId) {
  const indices = points.map((point) => addVertex(target, point, featureId));
  addTriangle(target, indices[0], indices[1], indices[2]);
  addTriangle(target, indices[0], indices[2], indices[3]);
}

function addBox(target, entity, featureId) {
  const { minX, maxX, minZ, maxZ } = entity.bounds;
  const base = entity.baseElevationAhd;
  const top = entity.topElevationAhd;
  addQuad(target, [[minX, top, minZ], [maxX, top, minZ], [maxX, top, maxZ], [minX, top, maxZ]], featureId);
  addQuad(target, [[minX, base, minZ], [minX, base, maxZ], [maxX, base, maxZ], [maxX, base, minZ]], featureId);
  addQuad(target, [[minX, base, minZ], [maxX, base, minZ], [maxX, top, minZ], [minX, top, minZ]], featureId);
  addQuad(target, [[maxX, base, minZ], [maxX, base, maxZ], [maxX, top, maxZ], [maxX, top, minZ]], featureId);
  addQuad(target, [[maxX, base, maxZ], [minX, base, maxZ], [minX, top, maxZ], [maxX, top, maxZ]], featureId);
  addQuad(target, [[minX, base, maxZ], [minX, base, minZ], [minX, top, minZ], [minX, top, maxZ]], featureId);
}

function addBuilding(target, entity, featureId) {
  if (!entity.polygons) {
    addBox(target, entity, featureId);
    return;
  }
  for (const polygon of entity.polygons) {
    const triangulated = triangulatePolygon(polygon);
    if (!triangulated) continue;
    const topIndices = triangulated.points.map(({ x, y }) => (
      addVertex(target, [x, entity.topElevationAhd, y], featureId)
    ));
    triangulated.faces.forEach(([a, b, c]) => addTriangle(target, topIndices[a], topIndices[b], topIndices[c]));
    for (const ring of triangulated.rings) {
      for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];
        addQuad(target, [
          [current.x, entity.baseElevationAhd, current.y],
          [next.x, entity.baseElevationAhd, next.y],
          [next.x, entity.topElevationAhd, next.y],
          [current.x, entity.topElevationAhd, current.y],
        ], featureId);
      }
    }
  }
}

function addWater(target, entity, featureId, elevationAhd) {
  for (const polygon of entity.polygons || []) {
    const triangulated = triangulatePolygon(polygon);
    if (!triangulated) continue;
    const indices = triangulated.points.map(({ x, y }) => (
      addVertex(target, [x, elevationAhd, y], featureId)
    ));
    triangulated.faces.forEach(([a, b, c]) => addTriangle(target, indices[a], indices[b], indices[c]));
  }
}

function addLineEntity(target, entity, featureId, heightAt, lift) {
  for (const line of entity.lines || entity.structureLines || entity.shorelineLines || []) {
    for (let index = 1; index < line.length; index += 1) {
      const [x0, z0] = line[index - 1];
      const [x1, z1] = line[index];
      const left = addVertex(target, [x0, heightAt(x0, z0) + lift, z0], featureId);
      const right = addVertex(target, [x1, heightAt(x1, z1) + lift, z1], featureId);
      target.indices.push(left, right);
    }
  }
}

function computeNormals(target) {
  const normals = new Float32Array(target.positions.length);
  for (let index = 0; index < target.indices.length; index += 3) {
    const ia = target.indices[index] * 3;
    const ib = target.indices[index + 1] * 3;
    const ic = target.indices[index + 2] * 3;
    const ab = [
      target.positions[ib] - target.positions[ia],
      target.positions[ib + 1] - target.positions[ia + 1],
      target.positions[ib + 2] - target.positions[ia + 2],
    ];
    const ac = [
      target.positions[ic] - target.positions[ia],
      target.positions[ic + 1] - target.positions[ia + 1],
      target.positions[ic + 2] - target.positions[ia + 2],
    ];
    const normal = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    for (const offset of [ia, ib, ic]) {
      normals[offset] += normal[0];
      normals[offset + 1] += normal[1];
      normals[offset + 2] += normal[2];
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]) || 1;
    normals[index] /= length;
    normals[index + 1] /= length;
    normals[index + 2] /= length;
  }
  return normals;
}

function terrainLookup(cells) {
  const bucketSize = 20;
  const buckets = new Map();
  for (const cell of cells) {
    const key = `${Math.floor(cell.x / bucketSize)}:${Math.floor(cell.z / bucketSize)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(cell);
  }
  return (x, z) => {
    const baseX = Math.floor(x / bucketSize);
    const baseZ = Math.floor(z / bucketSize);
    let nearest = null;
    let nearestDistance = Infinity;
    for (let radius = 0; radius <= 4 && !nearest; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          for (const cell of buckets.get(`${baseX + dx}:${baseZ + dz}`) || []) {
            const distance = (cell.x - x) ** 2 + (cell.z - z) ** 2;
            if (distance < nearestDistance) {
              nearest = cell;
              nearestDistance = distance;
            }
          }
        }
      }
    }
    return nearest?.elevationAhd ?? 0.1;
  };
}

function addTerrain(target, cells, tileBounds, lod, featureId) {
  const stride = [4, 2, 1][lod];
  const overlap = stride * 10 + 0.5;
  const selected = cells.filter((cell) => (
    cell.row % stride === 0 && cell.column % stride === 0
    && cell.x >= tileBounds.minX - overlap && cell.x <= tileBounds.maxX + overlap
    && cell.z >= tileBounds.minZ - overlap && cell.z <= tileBounds.maxZ + overlap
  ));
  const indicesByCell = new Map();
  selected.forEach((cell) => {
    indicesByCell.set(`${cell.row}:${cell.column}`, addVertex(
      target,
      [cell.x, cell.elevationAhd, cell.z],
      featureId,
    ));
  });
  selected.forEach((cell) => {
    const topRight = indicesByCell.get(`${cell.row}:${cell.column + stride}`);
    const bottomLeft = indicesByCell.get(`${cell.row + stride}:${cell.column}`);
    const bottomRight = indicesByCell.get(`${cell.row + stride}:${cell.column + stride}`);
    const topLeft = indicesByCell.get(`${cell.row}:${cell.column}`);
    if ([topLeft, topRight, bottomLeft, bottomRight].some((value) => value === undefined)) return;
    addTriangle(target, topLeft, bottomLeft, topRight);
    addTriangle(target, topRight, bottomLeft, bottomRight);
  });
}

function encodeGlb({ tile, lod, payload, entityIndex, terrainCells, heightAt }) {
  const features = [];
  const featureIds = new Map();
  const featureFor = (id, sourceLayerId) => {
    const key = `${sourceLayerId}:${id}`;
    if (!featureIds.has(key)) {
      featureIds.set(key, features.length);
      features.push({ id, sourceLayerId });
    }
    return featureIds.get(key);
  };
  const homeById = new Map(entityIndex.map((entity) => [entity.id, entity.homeTileId]));
  const primitives = {
    terrain: primitive('terrain', 4),
    buildings: primitive('buildings', 4),
    roads: primitive('roads', 1),
    pedestrian: primitive('pedestrian', 1),
    water: primitive('water', 4),
    trees: primitive('trees', 0),
    control: primitive('control', 0),
  };
  const terrainFeature = featureFor(
    `melbourne-vicmap-dem10m:${tile.id}`,
    'melbourne-vicmap-dem10m',
  );
  addTerrain(primitives.terrain, terrainCells, tile.boundsLocal, lod, terrainFeature);

  const sourceLayerByKey = {
    buildings: 'melbourne-buildings-2023',
    roads: 'melbourne-vicmap-roads',
    pedestrian: 'melbourne-pedestrian-network',
    water: 'melbourne-vicmap-hydro',
    trees: 'melbourne-urban-forest-trees',
    control: 'melbourne-vicmap-survey-control',
  };
  for (const [layerKey, entities] of Object.entries(payload.layers)) {
    if (layerKey === 'terrain') continue;
    for (const entity of entities) {
      if (homeById.get(entity.id) !== tile.id) continue;
      const featureId = featureFor(entity.id, sourceLayerByKey[layerKey]);
      if (layerKey === 'buildings') addBuilding(primitives.buildings, entity, featureId);
      else if (layerKey === 'roads') addLineEntity(primitives.roads, entity, featureId, heightAt, 0.18);
      else if (layerKey === 'pedestrian') addLineEntity(primitives.pedestrian, entity, featureId, heightAt, 0.24);
      else if (layerKey === 'water') addWater(primitives.water, entity, featureId, 0.1);
      else if (layerKey === 'trees') {
        const [x, z] = entity.horizontalPosition;
        addVertex(primitives.trees, [x, heightAt(x, z) + 0.5, z], featureId);
      } else if (layerKey === 'control') {
        addVertex(primitives.control, entity.scenePosition, featureId);
      }
    }
  }

  const materialEntries = Object.entries(MATERIALS);
  const materials = materialEntries.map(([, material]) => ({
    name: material.name,
    doubleSided: true,
    pbrMetallicRoughness: {
      baseColorFactor: material.color,
      metallicFactor: 0,
      roughnessFactor: 0.92,
    },
  }));
  const accessors = [];
  const bufferViews = [];
  const physicalParts = [];
  let physicalCursor = 0;
  let virtualCursor = 0;

  const compressedView = (typedArray, count, stride, mode, target) => {
    const source = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const encoded = MeshoptEncoder.encodeGltfBuffer(source, count, stride, mode);
    const physical = appendAligned(physicalParts, encoded, physicalCursor);
    physicalCursor = physical.cursor;
    const virtualOffset = align4(virtualCursor);
    virtualCursor = virtualOffset + source.byteLength;
    const view = {
      buffer: 1,
      byteOffset: virtualOffset,
      byteLength: source.byteLength,
      ...(target === 34962 ? { byteStride: stride } : {}),
      target,
      extensions: {
        EXT_meshopt_compression: {
          buffer: 0,
          byteOffset: physical.offset,
          byteLength: encoded.byteLength,
          byteStride: stride,
          count,
          mode,
          filter: 'NONE',
        },
      },
    };
    bufferViews.push(view);
    return bufferViews.length - 1;
  };
  const accessor = (view, componentType, count, type, min, max) => {
    accessors.push({ bufferView: view, componentType, count, type, ...(min ? { min, max } : {}) });
    return accessors.length - 1;
  };
  const meshPrimitives = [];
  let triangleCount = 0;
  let lineSegmentCount = 0;
  let pointCount = 0;
  for (const [materialIndex, [layerKey]] of materialEntries.entries()) {
    const source = primitives[layerKey];
    const vertexCount = source.positions.length / 3;
    if (vertexCount === 0 || source.indices.length === 0 && source.mode !== 0) continue;
    const positions = new Float32Array(source.positions);
    const positionView = compressedView(positions, vertexCount, 12, 'ATTRIBUTES', 34962);
    const valuesByAxis = [0, 1, 2].map((axis) => source.positions.filter((_, index) => index % 3 === axis));
    const attributes = {
      POSITION: accessor(
        positionView,
        5126,
        vertexCount,
        'VEC3',
        valuesByAxis.map((values) => Math.min(...values)),
        valuesByAxis.map((values) => Math.max(...values)),
      ),
    };
    if (source.mode === 4) {
      const normals = computeNormals(source);
      attributes.NORMAL = accessor(compressedView(normals, vertexCount, 12, 'ATTRIBUTES', 34962), 5126, vertexCount, 'VEC3');
    }
    const featureValues = new Uint32Array(source.featureIds);
    attributes._FEATURE_ID_0 = accessor(
      compressedView(featureValues, vertexCount, 4, 'ATTRIBUTES', 34962),
      5125,
      vertexCount,
      'SCALAR',
    );
    const primitive = { attributes, material: materialIndex, mode: source.mode };
    if (source.mode === 0) {
      pointCount += vertexCount;
    } else {
      const indexValues = vertexCount <= 65_535
        ? new Uint16Array(source.indices)
        : new Uint32Array(source.indices);
      const indexMode = source.mode === 4 ? 'TRIANGLES' : 'INDICES';
      const indexView = compressedView(
        indexValues,
        indexValues.length,
        indexValues.BYTES_PER_ELEMENT,
        indexMode,
        34963,
      );
      primitive.indices = accessor(
        indexView,
        indexValues.BYTES_PER_ELEMENT === 2 ? 5123 : 5125,
        indexValues.length,
        'SCALAR',
      );
      if (source.mode === 4) triangleCount += indexValues.length / 3;
      else lineSegmentCount += indexValues.length / 2;
    }
    meshPrimitives.push(primitive);
  }

  const statistics = {
    drawCalls: meshPrimitives.length,
    triangles: triangleCount,
    lineSegments: lineSegmentCount,
    points: pointCount,
    featureCount: features.length,
  };
  const gltf = {
    asset: { version: '2.0', generator: 'Project Afflatus Melbourne Analysis GLB builder' },
    extensionsUsed: ['EXT_meshopt_compression'],
    extensionsRequired: ['EXT_meshopt_compression'],
    scene: 0,
    scenes: [{ name: `${tile.id}-lod${lod}`, nodes: [0] }],
    nodes: [{ name: `${tile.id}-lod${lod}-analysis`, mesh: 0 }],
    meshes: [{ name: `${tile.id}-lod${lod}-layers`, primitives: meshPrimitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [
      { byteLength: align4(physicalCursor) },
      {
        byteLength: align4(virtualCursor),
        extensions: { EXT_meshopt_compression: { fallback: true } },
      },
    ],
    extras: {
      packageId: PACKAGE_ID,
      tileId: tile.id,
      lod,
      coordinateFrame: 'local-ENU-x-east-y-AHD-z-negative-north',
      features,
      statistics,
    },
  };
  const json = Buffer.from(JSON.stringify(gltf));
  const jsonLength = align4(json.length);
  const bin = Buffer.concat([...physicalParts, Buffer.alloc(align4(physicalCursor) - physicalCursor)]);
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + bin.length);
  output.write('glTF', 0, 4, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  output.fill(0x20, 20 + json.length, 20 + jsonLength);
  const binHeader = 20 + jsonLength;
  output.writeUInt32LE(bin.length, binHeader);
  output.writeUInt32LE(0x004e4942, binHeader + 4);
  bin.copy(output, binHeader + 8);
  return { bytes: output, statistics };
}

function readGlbJson(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
}

export async function buildMelbourneAnalysisGlb() {
  await MeshoptEncoder.ready;
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  const entityIndex = index.entities;
  const terrainCells = [];
  for (const tile of index.tiles) {
    const source = JSON.parse(readFileSync(resolve(PACKAGE_DIR, `${tile.id}-lod2.json`), 'utf8'));
    terrainCells.push(...source.layers.terrain);
  }
  const heightAt = terrainLookup(terrainCells);
  const runtimeAssets = [];
  const expectedGlbs = new Set();
  let totalTriangles = 0;
  let maximumTileBytes = 0;
  for (const tile of index.tiles) {
    for (const lod of [0, 1, 2]) {
      const payload = JSON.parse(readFileSync(resolve(PACKAGE_DIR, `${tile.id}-lod${lod}.json`), 'utf8'));
      const output = encodeGlb({ tile, lod, payload, entityIndex, terrainCells, heightAt });
      const filename = `${tile.id}-lod${lod}-analysis.glb`;
      const bytes = output.bytes;
      writeFileSync(resolve(PACKAGE_DIR, filename), bytes);
      expectedGlbs.add(filename);
      const asset = {
        id: filename.replace(/\.glb$/, ''),
        kind: 'geometry',
        uri: `${ASSET_BASE_URI}/${filename}`,
        sha256: sha256(bytes),
        byteLength: bytes.length,
        lod,
      };
      runtimeAssets.push(asset);
      const reference = tile.lods.find((entry) => entry.lod === lod);
      reference.runtimeAsset = {
        assetId: asset.id,
        uri: asset.uri,
        sha256: asset.sha256,
        byteLength: asset.byteLength,
        format: 'model/gltf-binary',
        compression: 'EXT_meshopt_compression',
        statistics: output.statistics,
      };
      totalTriangles += output.statistics.triangles;
      maximumTileBytes = Math.max(maximumTileBytes, bytes.length);
      const gltf = readGlbJson(bytes);
      if (gltf.extras.statistics.triangles !== output.statistics.triangles) {
        throw new Error(`${filename}: GLB statistics round-trip failed`);
      }
    }
  }
  for (const filename of readdirSync(PACKAGE_DIR)) {
    if (filename.endsWith('.glb') && !expectedGlbs.has(filename)) rmSync(resolve(PACKAGE_DIR, filename));
  }

  index.runtime = {
    representation: 'Analysis GLB',
    mimeType: 'model/gltf-binary',
    compression: 'EXT_meshopt_compression',
    textures: 'none',
    candidateOnly: true,
    dependencySemantics: 'direct-entity-home-tiles',
    totalTriangleInstancesAcrossAllLods: totalTriangles,
    maximumTileByteLength: maximumTileBytes,
  };
  const indexBytes = jsonBytes(index);
  writeFileSync(INDEX_PATH, indexBytes);
  const indexAsset = manifest.assets.find(({ kind }) => kind === 'entities-index');
  indexAsset.sha256 = sha256(indexBytes);
  indexAsset.byteLength = indexBytes.length;
  manifest.assets = [
    ...manifest.assets.filter(({ uri }) => !uri.endsWith('.glb')),
    ...runtimeAssets,
  ];
  const manifestBytes = jsonBytes(manifest, true);
  writeFileSync(MANIFEST_PATH, manifestBytes);
  const result = {
    packageId: PACKAGE_ID,
    runtimeAssetCount: runtimeAssets.length,
    totalAssetCount: manifest.assets.length,
    totalRuntimeBytes: runtimeAssets.reduce((sum, asset) => sum + asset.byteLength, 0),
    maximumTileBytes,
    totalTriangleInstancesAcrossAllLods: totalTriangles,
    manifestSha256: sha256(manifestBytes),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await buildMelbourneAnalysisGlb();
}
