import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target = resolve('public/assets/combat/afflatus-command.glb');
const data = await readFile(target);
if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('Combat GLB has an invalid magic header.');
if (data.readUInt32LE(4) !== 2) throw new Error('Combat GLB must use glTF 2.0.');
if (data.readUInt32LE(8) !== data.length) throw new Error('Combat GLB header length does not match the asset.');
// The original 17 KB primitive placeholder could fit under 180 KB, but it had
// no credible armour or surface structure.  The rebuilt seven-material hull
// remains intentionally sub-420 KB — still smaller than a single compressed
// hero image and bounded enough for the homepage critical path.
if (data.length > 420_000) throw new Error(`Combat GLB exceeds the 420 KB budget (${data.length} bytes).`);
console.log(`combat GLB ok (${data.length} bytes)`);

// Third-party combat craft are deliberately outside the critical 420 KB
// procedural-shell budget: both are lazy, KTX2 + Meshopt web derivatives and
// are only requested after the combat surface becomes active. Keep explicit
// ceilings here so a future asset refresh cannot silently restore the 6.7 MB
// fighter or 73.6 MB Venator downloads.
const authoredModelBudgets = new Map([
  ['fictional-6th-gen-fighter.glb', { min: 1_000_000, max: 3_100_000 }],
  ['fictional-6th-gen-fighter-cic.glb', { min: 850_000, max: 1_100_000 }],
  ['venator-class-star-destroyer.glb', { min: 4_000_000, max: 11_500_000 }],
  ['venator-class-star-destroyer-cic.glb', { min: 2_600_000, max: 3_000_000 }],
]);
const authoredModels = new Map();
for (const [name, budget] of authoredModelBudgets) {
  const model = await readFile(resolve('public/assets/combat/models', name));
  if (model.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${name} has an invalid GLB magic header.`);
  if (model.readUInt32LE(4) !== 2) throw new Error(`${name} must use glTF 2.0.`);
  if (model.readUInt32LE(8) !== model.length) throw new Error(`${name} has a mismatched GLB length header.`);
  if (model.length < budget.min || model.length > budget.max) {
    throw new Error(`${name} is outside its ${budget.min}-${budget.max} byte web budget (${model.length} bytes).`);
  }
  authoredModels.set(name, model);
  console.log(`${name} ok (${model.length} bytes)`);
}

const cicName = 'venator-class-star-destroyer-cic.glb';
const cicModel = authoredModels.get(cicName);
const cicJsonLength = cicModel.readUInt32LE(12);
if (cicModel.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${cicName} is missing its JSON chunk.`);
const cicJsonEnd = 20 + cicJsonLength;
const cicBinLength = cicModel.readUInt32LE(cicJsonEnd);
if (cicModel.readUInt32LE(cicJsonEnd + 4) !== 0x004e4942) throw new Error(`${cicName} is missing its BIN chunk.`);
if (cicJsonEnd + 8 + cicBinLength !== cicModel.length) throw new Error(`${cicName} has an invalid BIN chunk length.`);
const cicJson = JSON.parse(cicModel.toString('utf8', 20, cicJsonEnd));
const cicBin = cicModel.subarray(cicJsonEnd + 8);
const expectedCicNodes = [
  'venator_bridge_Venator Bridge_0',
  'Cube.345_emission_0',
  'engines_engines_0',
  'doors_doors_0',
  'venator_body_top_Venator Body Top_0',
  'venator_body_middle_venator body middle_0',
  'venator_body_bottom_venator body bottom_0',
].sort();
const actualCicNodes = cicJson.nodes?.map((node) => node.name).sort();
if (JSON.stringify(actualCicNodes) !== JSON.stringify(expectedCicNodes)) {
  throw new Error(`${cicName} does not contain the expected seven CIC hull nodes.`);
}
if (cicJson.meshes?.length !== 7 || cicJson.materials?.length !== 7) throw new Error(`${cicName} must contain seven meshes and materials.`);
if (cicJson.textures?.length !== 18 || cicJson.images?.length !== 18) throw new Error(`${cicName} must contain 18 retained textures and images.`);
if (cicJson.accessors?.length !== 33 || cicJson.bufferViews?.length !== 46) throw new Error(`${cicName} has unpruned geometry dependencies.`);
if (cicJson.buffers?.length !== 2 || cicJson.buffers[0].byteLength !== cicBin.length) throw new Error(`${cicName} has an invalid compacted buffer layout.`);
if (cicJson.extensionsUsed?.includes('KHR_materials_specular') || cicJson.extensionsRequired?.includes('KHR_materials_specular')) {
  throw new Error(`${cicName} must not declare KHR_materials_specular.`);
}
if (cicJson.materials.some((material) => material.extensions?.KHR_materials_specular)) {
  throw new Error(`${cicName} still contains specular material data.`);
}
if (/trench[_ ]greebles|bottom[_ ]greebles|turbolaser/i.test(JSON.stringify(cicJson))) {
  throw new Error(`${cicName} still contains a removed CIC detail node or dependency.`);
}

let cicTriangles = 0;
for (const mesh of cicJson.meshes) {
  if (mesh.primitives?.length !== 1 || mesh.primitives[0].mode !== 4) throw new Error(`${cicName} meshes must contain one triangle primitive.`);
  const indexAccessor = cicJson.accessors[mesh.primitives[0].indices];
  if (!indexAccessor || indexAccessor.count % 3 !== 0) throw new Error(`${cicName} has an invalid index accessor.`);
  cicTriangles += indexAccessor.count / 3;
}
if (cicTriangles !== 105_142) throw new Error(`${cicName} must contain exactly 105142 rendered triangles (${cicTriangles}).`);

const embeddedKtxIdentifier = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
for (const [index, image] of cicJson.images.entries()) {
  const view = cicJson.bufferViews[image.bufferView];
  const offset = view?.byteOffset ?? 0;
  if (image.mimeType !== 'image/ktx2' || view?.buffer !== 0 || !cicBin.subarray(offset, offset + 12).equals(embeddedKtxIdentifier)) {
    throw new Error(`${cicName} image ${index} is not a valid embedded KTX2 texture.`);
  }
}
for (const [index, texture] of cicJson.textures.entries()) {
  const source = texture.extensions?.KHR_texture_basisu?.source;
  if (!Number.isInteger(source) || source < 0 || source >= cicJson.images.length) {
    throw new Error(`${cicName} texture ${index} has an invalid BasisU image reference.`);
  }
}

const textureRoles = { baseColor: new Set(), normal: new Set(), orm: new Set() };
const assertCicTexture = (textureIndex, size, mipCount, role) => {
  const source = cicJson.textures[textureIndex]?.extensions?.KHR_texture_basisu?.source;
  const image = cicJson.images[source];
  const view = cicJson.bufferViews[image?.bufferView];
  const offset = view?.byteOffset ?? 0;
  const encoded = cicBin.subarray(offset, offset + (view?.byteLength ?? 0));
  if (encoded.readUInt32LE(20) !== size || encoded.readUInt32LE(24) !== size || encoded.readUInt32LE(40) !== mipCount) {
    throw new Error(`${cicName} ${role} texture ${textureIndex} must be ${size}px with ${mipCount} mip levels.`);
  }
  textureRoles[role].add(textureIndex);
};
for (const material of cicJson.materials) {
  const baseColor = material.pbrMetallicRoughness?.baseColorTexture?.index;
  if (!Number.isInteger(baseColor)) {
    if (material.name !== 'emission') throw new Error(`${cicName} material ${material.name} is missing its base-color texture.`);
    continue;
  }
  const normal = material.normalTexture?.index;
  const orm = material.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
  if (material.occlusionTexture?.index !== orm) throw new Error(`${cicName} material ${material.name} must share its ORM texture.`);
  assertCicTexture(baseColor, 512, 10, 'baseColor');
  assertCicTexture(normal, 256, 9, 'normal');
  assertCicTexture(orm, 256, 9, 'orm');
}
if (textureRoles.baseColor.size !== 6 || textureRoles.normal.size !== 6 || textureRoles.orm.size !== 6) {
  throw new Error(`${cicName} must contain six 512px base-color, six 256px normal and six 256px ORM textures.`);
}

const align4 = (value) => (value + 3) & ~3;
const physicalRanges = [];
const virtualRanges = [];
for (const [index, view] of cicJson.bufferViews.entries()) {
  if (view.buffer === 0) {
    physicalRanges.push({ offset: view.byteOffset ?? 0, length: view.byteLength, label: `bufferView ${index}` });
    continue;
  }
  const meshopt = view.extensions?.EXT_meshopt_compression;
  if (view.buffer !== 1 || meshopt?.buffer !== 0) throw new Error(`${cicName} bufferView ${index} has an invalid Meshopt layout.`);
  physicalRanges.push({ offset: meshopt.byteOffset ?? 0, length: meshopt.byteLength, label: `Meshopt bufferView ${index}` });
  virtualRanges.push({ offset: view.byteOffset ?? 0, length: view.byteLength, label: `virtual bufferView ${index}` });
}
const assertPackedRanges = (assetName, ranges, expectedLength, label) => {
  ranges.sort((a, b) => a.offset - b.offset);
  let cursor = 0;
  for (const range of ranges) {
    const expectedOffset = align4(cursor);
    if (range.offset !== expectedOffset || range.length <= 0) {
      throw new Error(`${assetName} ${label} is not tightly packed at ${range.label}.`);
    }
    cursor = range.offset + range.length;
  }
  if (align4(cursor) !== expectedLength) throw new Error(`${assetName} ${label} length does not match its packed ranges.`);
};
assertPackedRanges(cicName, physicalRanges, cicJson.buffers[0].byteLength, 'physical BIN');
assertPackedRanges(cicName, virtualRanges, cicJson.buffers[1].byteLength, 'Meshopt fallback buffer');
console.log(`${cicName} structure ok (${cicTriangles} triangles, ${cicJson.nodes.length} nodes, ${cicJson.materials.length} materials, ${cicJson.textures.length} textures)`);

const parseAuthoredGlb = (model, name) => {
  const jsonLength = model.readUInt32LE(12);
  if (model.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${name} is missing its JSON chunk.`);
  const jsonEnd = 20 + jsonLength;
  const binLength = model.readUInt32LE(jsonEnd);
  if (model.readUInt32LE(jsonEnd + 4) !== 0x004e4942 || jsonEnd + 8 + binLength !== model.length) {
    throw new Error(`${name} has an invalid BIN chunk.`);
  }
  return {
    json: JSON.parse(model.toString('utf8', 20, jsonEnd)),
    bin: model.subarray(jsonEnd + 8),
  };
};
const fighterName = 'fictional-6th-gen-fighter-cic.glb';
const fighter = parseAuthoredGlb(authoredModels.get(fighterName), fighterName);
const fighterSource = parseAuthoredGlb(authoredModels.get('fictional-6th-gen-fighter.glb'), 'fictional-6th-gen-fighter.glb');
if (fighter.json.nodes?.length !== 39 || fighter.json.meshes?.length !== 5 || fighter.json.materials?.length !== 5) {
  throw new Error(`${fighterName} must preserve all 39 nodes, five meshes and five materials.`);
}
if (fighter.json.textures?.length !== 16 || fighter.json.images?.length !== 16 || fighter.json.accessors?.length !== 25 || fighter.json.bufferViews?.length !== 37) {
  throw new Error(`${fighterName} has an unexpected texture or geometry dependency count.`);
}
for (const key of ['scenes', 'nodes', 'meshes', 'materials', 'textures', 'images', 'samplers', 'accessors']) {
  if (JSON.stringify(fighter.json[key]) !== JSON.stringify(fighterSource.json[key])) {
    throw new Error(`${fighterName} changed source ${key}; only embedded texture data and buffer offsets may differ.`);
  }
}
const expectedFighterNozzles = [
  'nozzle_L_U_01',
  'nozzle_L_D_02',
  'nozzle_R_U_03',
  'nozzle_R_D_04',
  'nozzle_L_RU_017',
  'nozzle_R_RU_018',
  'nozzle_R_RD_019',
  'nozzle_L_RD_020',
].sort();
const fighterNozzles = fighter.json.nodes.map((node) => node.name).filter((name) => name.startsWith('nozzle_')).sort();
if (JSON.stringify(fighterNozzles) !== JSON.stringify(expectedFighterNozzles)) throw new Error(`${fighterName} does not preserve all nozzle anchors.`);
if (fighter.json.buffers?.length !== 2 || fighter.json.buffers[0].byteLength !== fighter.bin.length) throw new Error(`${fighterName} has an invalid compacted buffer layout.`);

let fighterTriangles = 0;
for (const mesh of fighter.json.meshes) {
  if (mesh.primitives?.length !== 1 || mesh.primitives[0].mode !== 4) throw new Error(`${fighterName} meshes must contain one triangle primitive.`);
  const accessor = fighter.json.accessors[mesh.primitives[0].indices];
  if (!accessor || accessor.count % 3 !== 0) throw new Error(`${fighterName} has an invalid index accessor.`);
  fighterTriangles += accessor.count / 3;
}
if (fighterTriangles !== 43_169) throw new Error(`${fighterName} must contain exactly 43169 rendered triangles (${fighterTriangles}).`);

const fighterTextureInfo = (textureIndex) => {
  const source = fighter.json.textures[textureIndex]?.extensions?.KHR_texture_basisu?.source;
  const image = fighter.json.images[source];
  const view = fighter.json.bufferViews[image?.bufferView];
  const offset = view?.byteOffset ?? 0;
  const encoded = fighter.bin.subarray(offset, offset + (view?.byteLength ?? 0));
  if (image?.mimeType !== 'image/ktx2' || view?.buffer !== 0 || !encoded.subarray(0, 12).equals(embeddedKtxIdentifier)) {
    throw new Error(`${fighterName} texture ${textureIndex} is not a valid embedded KTX2 image.`);
  }
  const dfdOffset = encoded.readUInt32LE(48);
  const descriptorSize = encoded.readUInt16LE(dfdOffset + 10);
  return {
    width: encoded.readUInt32LE(20),
    height: encoded.readUInt32LE(24),
    mipCount: encoded.readUInt32LE(40),
    supercompression: encoded.readUInt32LE(44),
    transfer: encoded[dfdOffset + 14],
    samples: (descriptorSize - 24) / 16,
  };
};
const fighterTextureRoles = { baseColor: new Set(), normal: new Set(), orm: new Set(), emissive: new Set() };
const assertFighterTexture = (textureIndex, role, preserveAlpha = false) => {
  if (!Number.isInteger(textureIndex)) throw new Error(`${fighterName} is missing a ${role} texture reference.`);
  const info = fighterTextureInfo(textureIndex);
  const linear = role === 'normal' || role === 'orm';
  if (info.width !== 512 || info.height !== 512 || info.mipCount !== 10) {
    throw new Error(`${fighterName} ${role} texture ${textureIndex} must be 512px with 10 mip levels.`);
  }
  if (info.transfer !== (linear ? 1 : 2)) throw new Error(`${fighterName} ${role} texture ${textureIndex} has an invalid transfer function.`);
  if (info.supercompression !== (role === 'normal' ? 2 : 1)) throw new Error(`${fighterName} ${role} texture ${textureIndex} uses the wrong KTX2 codec.`);
  if (info.samples !== (preserveAlpha ? 2 : 1)) throw new Error(`${fighterName} ${role} texture ${textureIndex} has an invalid alpha layout.`);
  fighterTextureRoles[role].add(textureIndex);
};
for (const material of fighter.json.materials) {
  const pbr = material.pbrMetallicRoughness;
  assertFighterTexture(pbr?.baseColorTexture?.index, 'baseColor', material.alphaMode === 'BLEND');
  assertFighterTexture(material.normalTexture?.index, 'normal');
  assertFighterTexture(pbr?.metallicRoughnessTexture?.index, 'orm');
  if (material.emissiveTexture) assertFighterTexture(material.emissiveTexture.index, 'emissive');
}
if (fighterTextureRoles.baseColor.size !== 5 || fighterTextureRoles.normal.size !== 5 || fighterTextureRoles.orm.size !== 5 || fighterTextureRoles.emissive.size !== 1) {
  throw new Error(`${fighterName} must contain five base-color, five normal, five ORM and one emissive texture.`);
}

const fighterPhysicalRanges = [];
const fighterVirtualRanges = [];
for (const [index, view] of fighter.json.bufferViews.entries()) {
  if (view.buffer === 0) {
    fighterPhysicalRanges.push({ offset: view.byteOffset ?? 0, length: view.byteLength, label: `bufferView ${index}` });
    continue;
  }
  const meshopt = view.extensions?.EXT_meshopt_compression;
  if (view.buffer !== 1 || meshopt?.buffer !== 0) throw new Error(`${fighterName} bufferView ${index} has an invalid Meshopt layout.`);
  const sourceView = structuredClone(fighterSource.json.bufferViews[index]);
  const targetView = structuredClone(view);
  delete sourceView.byteOffset;
  delete targetView.byteOffset;
  delete sourceView.extensions.EXT_meshopt_compression.byteOffset;
  delete targetView.extensions.EXT_meshopt_compression.byteOffset;
  if (JSON.stringify(sourceView) !== JSON.stringify(targetView)) throw new Error(`${fighterName} changed geometry bufferView ${index}.`);
  fighterPhysicalRanges.push({ offset: meshopt.byteOffset ?? 0, length: meshopt.byteLength, label: `Meshopt bufferView ${index}` });
  fighterVirtualRanges.push({ offset: view.byteOffset ?? 0, length: view.byteLength, label: `virtual bufferView ${index}` });
}
assertPackedRanges(fighterName, fighterPhysicalRanges, fighter.json.buffers[0].byteLength, 'physical BIN');
assertPackedRanges(fighterName, fighterVirtualRanges, fighter.json.buffers[1].byteLength, 'Meshopt fallback buffer');
console.log(`${fighterName} structure ok (${fighterTriangles} triangles, ${fighter.json.nodes.length} nodes, ${fighter.json.materials.length} materials, ${fighter.json.textures.length} textures)`);

const ktxIdentifier = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const textureBudgets = new Map([
  ['vanguard-normal.ktx2', 1_400_000],
  ['vanguard-orm.ktx2', 260_000],
  ['vanguard-detail-wear.ktx2', 240_000],
]);
for (const [name, budget] of textureBudgets) {
  const texture = await readFile(resolve('public/assets/combat/materials', name));
  if (!texture.subarray(0, 12).equals(ktxIdentifier)) throw new Error(`${name} has an invalid KTX2 identifier.`);
  const width = texture.readUInt32LE(20);
  const height = texture.readUInt32LE(24);
  const mipCount = texture.readUInt32LE(40);
  if (width !== 1024 || height !== 1024 || mipCount !== 11) {
    throw new Error(`${name} must be a 1024px KTX2 texture with 11 mip levels.`);
  }
  if (texture.length > budget) throw new Error(`${name} exceeds its ${budget}-byte budget (${texture.length} bytes).`);
  console.log(`${name} ok (${texture.length} bytes, ${width}px, ${mipCount} mips)`);
}

for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  const transcoder = await readFile(resolve('public/vendor/basis', name));
  if (transcoder.length < 32_000) throw new Error(`${name} is missing or truncated.`);
}
