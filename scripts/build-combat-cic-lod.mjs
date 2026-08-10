import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const sourcePath = resolve('public/assets/combat/models/venator-class-star-destroyer.glb');
const outputPath = resolve('public/assets/combat/models/venator-class-star-destroyer-cic.glb');
const fighterSourcePath = resolve('public/assets/combat/models/fictional-6th-gen-fighter.glb');
const fighterOutputPath = resolve('public/assets/combat/models/fictional-6th-gen-fighter-cic.glb');

const keepNodeNames = [
  'venator_bridge_Venator Bridge_0',
  'Cube.345_emission_0',
  'engines_engines_0',
  'doors_doors_0',
  'venator_body_top_Venator Body Top_0',
  'venator_body_middle_venator body middle_0',
  'venator_body_bottom_venator body bottom_0',
];
const dropNodeNames = [
  'trench_greebles_2_greebles2_0',
  'trench_greebles_1_greebles1_0',
  'turbolaser_1_turbolaser 1_0',
  'turbolaser_2_Turbo2_0',
  'bottom greebles_bottom greebles_0',
];

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const KTX2_IDENTIFIER = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const run = promisify(execFile);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function align4(value) {
  return (value + 3) & ~3;
}

function parseGlb(data) {
  invariant(data.toString('ascii', 0, 4) === 'glTF', 'Source has an invalid GLB magic header.');
  invariant(data.readUInt32LE(4) === 2, 'Source must use glTF 2.0.');
  invariant(data.readUInt32LE(8) === data.length, 'Source GLB length header is invalid.');

  const jsonLength = data.readUInt32LE(12);
  invariant(data.readUInt32LE(16) === JSON_CHUNK_TYPE, 'Source GLB must start with a JSON chunk.');
  const jsonEnd = 20 + jsonLength;
  invariant(jsonEnd + 8 <= data.length, 'Source GLB JSON chunk is truncated.');
  const binLength = data.readUInt32LE(jsonEnd);
  invariant(data.readUInt32LE(jsonEnd + 4) === BIN_CHUNK_TYPE, 'Source GLB must contain one BIN chunk.');
  const binStart = jsonEnd + 8;
  invariant(binStart + binLength === data.length, 'Source GLB BIN chunk is truncated or has trailing chunks.');

  return {
    json: JSON.parse(data.toString('utf8', 20, jsonEnd)),
    bin: data.subarray(binStart, binStart + binLength),
  };
}

async function runBasisu(args, task) {
  try {
    return await run('basisu', args, { maxBuffer: 16 * 1024 * 1024 });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('The basisu CLI is required to build the Venator CIC LOD. Install Basis Universal and ensure `basisu` is on PATH.', { cause: error });
    }
    const detail = error.stderr?.trim();
    throw new Error(`basisu failed while ${task}${detail ? `: ${detail}` : '.'}`, { cause: error });
  }
}

function mipCountForSize(size) {
  return Math.log2(size) + 1;
}

function ktxSampleCount(encoded) {
  const dfdOffset = encoded.readUInt32LE(48);
  invariant(dfdOffset + 24 <= encoded.length, 'KTX2 data format descriptor is truncated.');
  const descriptorSize = encoded.readUInt16LE(dfdOffset + 10);
  invariant(descriptorSize >= 40 && (descriptorSize - 24) % 16 === 0, 'KTX2 data format descriptor has an invalid sample layout.');
  return (descriptorSize - 24) / 16;
}

function ktxTransferFunction(encoded) {
  return encoded[encoded.readUInt32LE(48) + 14];
}

function extractDdsMip(dds, sourceSize, targetSize) {
  invariant(dds.toString('ascii', 0, 4) === 'DDS ', 'basisu produced an invalid DDS file.');
  invariant(dds.readUInt32LE(4) === 124 && dds.toString('ascii', 84, 88) === 'DX10', 'Expected a DX10 DDS header.');
  invariant(dds.readUInt32LE(128) === 28 || dds.readUInt32LE(128) === 29, 'Expected basisu to export linear or sRGB RGBA32 DDS data.');
  const width = dds.readUInt32LE(16);
  const height = dds.readUInt32LE(12);
  invariant(width === sourceSize && height === sourceSize, `Expected a ${sourceSize}px source DDS.`);
  invariant(dds.readUInt32LE(28) === mipCountForSize(sourceSize), `Expected the source DDS to contain ${mipCountForSize(sourceSize)} mip levels.`);

  let mipWidth = width;
  let mipHeight = height;
  let offset = 148;
  while (mipWidth > targetSize || mipHeight > targetSize) {
    offset += mipWidth * mipHeight * 4;
    mipWidth = Math.max(1, mipWidth >> 1);
    mipHeight = Math.max(1, mipHeight >> 1);
  }
  invariant(mipWidth === targetSize && mipHeight === targetSize, `DDS does not contain a ${targetSize}px mip level.`);
  const byteLength = targetSize * targetSize * 4;
  invariant(offset + byteLength <= dds.length, 'DDS mip data is truncated.');

  const header = Buffer.from(dds.subarray(0, 148));
  header.writeUInt32LE(targetSize, 12);
  header.writeUInt32LE(targetSize, 16);
  header.writeUInt32LE(1, 28);
  header.writeUInt32LE(header.readUInt32LE(8) & ~0x20000, 8);
  header.writeUInt32LE(header.readUInt32LE(108) & ~0x400008, 108);
  return Buffer.concat([header, dds.subarray(offset, offset + byteLength)]);
}

async function reencodeTextures(json, sourceBin, imageRoles, profile) {
  const expectedImageCount = Object.values(profile.roleCounts).reduce((sum, count) => sum + count, 0);
  invariant(imageRoles.size === expectedImageCount, `Expected ${expectedImageCount} uniquely mapped ${profile.label} texture images.`);
  for (const [role, expectedCount] of Object.entries(profile.roleCounts)) {
    const actualCount = [...imageRoles.values()].filter((image) => image.role === role).length;
    invariant(actualCount === expectedCount, `Expected ${expectedCount} ${profile.label} ${role} maps.`);
  }
  for (const [imageIndex, imageRole] of imageRoles) {
    const view = json.bufferViews[json.images[imageIndex].bufferView];
    const sourceKtx = sourceBin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    invariant(sourceKtx.subarray(0, 12).equals(KTX2_IDENTIFIER), `Source ${imageRole.role} image ${imageIndex} is not KTX2.`);
    invariant(sourceKtx.readUInt32LE(20) === profile.sourceSize && sourceKtx.readUInt32LE(24) === profile.sourceSize, `Source ${imageRole.role} image ${imageIndex} must be ${profile.sourceSize}px.`);
    invariant(sourceKtx.readUInt32LE(40) === mipCountForSize(profile.sourceSize), `Source ${imageRole.role} image ${imageIndex} has an invalid mip count.`);
    if (imageRole.preserveAlpha) invariant(ktxSampleCount(sourceKtx) === 2, `Source ${imageRole.role} image ${imageIndex} must contain alpha.`);
  }
  await runBasisu(['-version'], 'checking availability');
  const scratchDir = await mkdtemp(resolve(tmpdir(), profile.scratchPrefix));
  const encodedImages = new Map();
  try {
    const outputImages = [...imageRoles.entries()]
      .filter(([, imageRole]) => !profile.preserveRoles.includes(imageRole.role))
      .sort(([a], [b]) => a - b);

    for (const [imageIndex, imageRole] of outputImages) {
      const { role, preserveAlpha } = imageRole;
      const view = json.bufferViews[json.images[imageIndex].bufferView];
      const sourceKtx = sourceBin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const stem = `${role}-${String(imageIndex).padStart(2, '0')}`;
      const sourcePath = resolve(scratchDir, `${stem}-${profile.sourceSize}.ktx2`);
      const exportedPath = resolve(scratchDir, `${stem}-${profile.sourceSize}.dds`);
      const mipPath = resolve(scratchDir, `${stem}-${profile.targetSize}.dds`);
      const outputPath = resolve(scratchDir, `${stem}-${profile.targetSize}.ktx2`);
      await writeFile(sourcePath, sourceKtx);
      await runBasisu([
        '-file', sourcePath,
        '-export_dds', 'RGBA32',
        '-output_file', exportedPath,
        '-no_multithreading',
        '-quiet',
      ], `decoding ${stem}`);
      await writeFile(mipPath, extractDdsMip(await readFile(exportedPath), profile.sourceSize, profile.targetSize));

      const codecOptions = role === 'normal'
        ? ['-uastc', '-uastc_level', '2', '-uastc_rdo_l', '1.4', '-uastc_rdo_m', '-normal_map', '-mip_renorm']
        : role === 'orm'
          ? ['-linear', '-quality', '82', '-effort', '5', '-mip_linear']
          : ['-srgb', '-quality', '85', '-effort', '5', '-mip_srgb'];
      await runBasisu([
        '-file', mipPath,
        '-output_file', outputPath,
        '-ktx2',
        '-mipmap',
        ...(preserveAlpha ? [] : ['-no_alpha']),
        '-no_multithreading',
        '-quiet',
        ...codecOptions,
      ], `encoding ${stem}`);
      await runBasisu([outputPath, '-validate', '-quiet'], `validating ${stem}`);
      const encoded = await readFile(outputPath);
      invariant(encoded.subarray(0, 12).equals(KTX2_IDENTIFIER), `${stem} has an invalid KTX2 identifier.`);
      invariant(encoded.readUInt32LE(20) === profile.targetSize && encoded.readUInt32LE(24) === profile.targetSize, `${stem} has an invalid KTX2 size.`);
      invariant(encoded.readUInt32LE(40) === mipCountForSize(profile.targetSize), `${stem} has an invalid mip count.`);
      invariant(ktxTransferFunction(encoded) === (role === 'normal' || role === 'orm' ? 1 : 2), `${stem} has an invalid color transfer function.`);
      invariant(encoded.readUInt32LE(44) === (role === 'normal' ? 2 : 1), `${stem} has an unexpected KTX2 supercompression scheme.`);
      invariant(ktxSampleCount(encoded) === (preserveAlpha ? 2 : 1), `${stem} has an invalid alpha layout.`);
      encodedImages.set(imageIndex, encoded);
    }
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
  return encodedImages;
}

function assertSourceShape(json, bin) {
  invariant(json.scenes?.length === 1 && json.scene === 0, 'Expected one default Venator scene.');
  invariant(json.nodes?.length === 12 && json.meshes?.length === 12, 'Expected the 12-node flattened Venator source.');
  invariant(json.materials?.length === 12, 'Expected 12 Venator source materials.');
  invariant(json.textures?.length === 44 && json.images?.length === 44, 'Expected 44 Venator source KTX2 textures.');
  invariant(json.samplers?.length === 1, 'Expected one shared Venator texture sampler.');
  invariant(json.accessors?.length === 58 && json.bufferViews?.length === 92, 'Unexpected Venator geometry layout.');
  invariant(json.buffers?.length === 2, 'Expected physical and Meshopt fallback buffers.');
  invariant(json.buffers[0].byteLength === bin.length, 'Physical buffer length does not match the GLB BIN chunk.');
  invariant(json.buffers[1].extensions?.EXT_meshopt_compression?.fallback === true, 'Missing Meshopt fallback buffer.');
  invariant(!json.animations && !json.skins, 'CIC LOD builder does not support animations or skins.');

  const expectedNodeNames = [...keepNodeNames, ...dropNodeNames].sort();
  const actualNodeNames = json.nodes.map((node) => node.name).sort();
  invariant(JSON.stringify(actualNodeNames) === JSON.stringify(expectedNodeNames), 'Venator source node names changed.');
  invariant(json.scenes[0].nodes?.length === 12, 'Expected every source node at the scene root.');

  json.nodes.forEach((node, index) => {
    invariant(node.mesh === index && !node.children, `Expected flat one-to-one node/mesh mapping at node ${index}.`);
  });
  json.meshes.forEach((mesh, index) => {
    invariant(mesh.primitives?.length === 1, `Expected one primitive in source mesh ${index}.`);
    const primitive = mesh.primitives[0];
    invariant(primitive.mode === 4 && Number.isInteger(primitive.indices), `Expected indexed triangles in source mesh ${index}.`);
    invariant(!primitive.targets, `Source mesh ${index} unexpectedly has morph targets.`);
  });
  json.materials.forEach((material, index) => {
    invariant(material.extensions?.KHR_materials_specular, `Source material ${index} lost its specular extension.`);
  });
  json.images.forEach((image, index) => {
    invariant(image.mimeType === 'image/ktx2' && Number.isInteger(image.bufferView), `Source image ${index} is not an embedded KTX2 image.`);
    const view = json.bufferViews[image.bufferView];
    invariant(view.buffer === 0 && !view.extensions, `Source KTX2 image ${index} has an unexpected buffer layout.`);
    invariant(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + 12).equals(KTX2_IDENTIFIER), `Source image ${index} has an invalid KTX2 identifier.`);
  });
  invariant(json.extensionsUsed?.includes('KHR_materials_specular'), 'Source does not declare KHR_materials_specular.');
  invariant(json.extensionsUsed?.includes('EXT_meshopt_compression'), 'Source does not declare EXT_meshopt_compression.');
  invariant(json.extensionsUsed?.includes('KHR_texture_basisu'), 'Source does not declare KHR_texture_basisu.');
}

function remapList(indices) {
  return new Map(indices.map((oldIndex, newIndex) => [oldIndex, newIndex]));
}

function remapMaterialTextureIndices(value, textureMap) {
  if (Array.isArray(value)) {
    value.forEach((item) => remapMaterialTextureIndices(item, textureMap));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'index' && Number.isInteger(child)) {
      invariant(textureMap.has(child), `Material references removed texture ${child}.`);
      value[key] = textureMap.get(child);
    } else {
      remapMaterialTextureIndices(child, textureMap);
    }
  }
}

function collectMaterialTextureIndices(value, result) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectMaterialTextureIndices(item, result));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'index' && Number.isInteger(child)) result.add(child);
    else collectMaterialTextureIndices(child, result);
  }
}

function setTextureRole(textureRoles, index, role) {
  invariant(Number.isInteger(index), `Missing ${role} texture reference.`);
  invariant(!textureRoles.has(index) || textureRoles.get(index) === role, `Texture ${index} is used as conflicting material channels.`);
  textureRoles.set(index, role);
}

async function buildCicLod(source) {
  const json = structuredClone(source.json);
  assertSourceShape(json, source.bin);

  const nodeIndices = json.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => keepNodeNames.includes(node.name))
    .map(({ index }) => index);
  const nodeMap = remapList(nodeIndices);
  const meshIndices = nodeIndices.map((index) => json.nodes[index].mesh);
  const meshMap = remapList(meshIndices);

  const materialIndices = [...new Set(meshIndices.flatMap((meshIndex) => (
    json.meshes[meshIndex].primitives.map((primitive) => primitive.material)
  )))].sort((a, b) => a - b);
  const materialMap = remapList(materialIndices);
  const materials = materialIndices.map((index) => {
    const material = structuredClone(json.materials[index]);
    delete material.extensions.KHR_materials_specular;
    if (Object.keys(material.extensions).length === 0) delete material.extensions;
    return material;
  });

  const textureRoles = new Map();
  materials.forEach((material) => {
    const baseColor = material.pbrMetallicRoughness?.baseColorTexture?.index;
    if (!Number.isInteger(baseColor)) {
      invariant(material.name === 'emission' && !material.normalTexture && !material.occlusionTexture, 'Only the emissive hull material may omit CIC textures.');
      return;
    }
    const orm = material.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
    invariant(material.occlusionTexture?.index === orm, `${material.name} must share one ORM texture for metallic-roughness and occlusion.`);
    setTextureRole(textureRoles, baseColor, 'baseColor');
    setTextureRole(textureRoles, material.normalTexture?.index, 'normal');
    setTextureRole(textureRoles, orm, 'orm');
  });
  invariant([...textureRoles.values()].filter((role) => role === 'baseColor').length === 6, 'Expected six CIC base-color maps.');

  const textureIndexSet = new Set();
  materials.forEach((material) => collectMaterialTextureIndices(material, textureIndexSet));
  const textureIndices = [...textureIndexSet].sort((a, b) => a - b);
  const textureMap = remapList(textureIndices);

  const imageIndices = [...new Set(textureIndices.map((index) => {
    const texture = json.textures[index];
    invariant(texture.extensions?.KHR_texture_basisu && texture.source === undefined, `Texture ${index} is not a BasisU-only texture.`);
    return texture.extensions.KHR_texture_basisu.source;
  }))].sort((a, b) => a - b);
  const imageMap = remapList(imageIndices);
  const imageRoles = new Map();
  textureIndices.forEach((textureIndex) => {
    const imageIndex = json.textures[textureIndex].extensions.KHR_texture_basisu.source;
    invariant(!imageRoles.has(imageIndex), `CIC textures unexpectedly share source image ${imageIndex}.`);
    imageRoles.set(imageIndex, { role: textureRoles.get(textureIndex), preserveAlpha: false });
  });
  const reencodedImages = await reencodeTextures(json, source.bin, imageRoles, {
    label: 'Venator CIC',
    scratchPrefix: 'afflatus-venator-cic-',
    sourceSize: 512,
    targetSize: 256,
    roleCounts: { baseColor: 6, normal: 6, orm: 6 },
    preserveRoles: ['baseColor'],
  });
  const reencodedBufferViews = new Map([...reencodedImages].map(([imageIndex, encoded]) => (
    [json.images[imageIndex].bufferView, encoded]
  )));
  const samplerIndices = [...new Set(textureIndices.map((index) => json.textures[index].sampler))].sort((a, b) => a - b);
  const samplerMap = remapList(samplerIndices);

  const accessorIndexSet = new Set();
  meshIndices.forEach((meshIndex) => {
    json.meshes[meshIndex].primitives.forEach((primitive) => {
      accessorIndexSet.add(primitive.indices);
      Object.values(primitive.attributes).forEach((index) => accessorIndexSet.add(index));
    });
  });
  const accessorIndices = [...accessorIndexSet].sort((a, b) => a - b);
  const accessorMap = remapList(accessorIndices);

  const bufferViewIndices = [...new Set([
    ...accessorIndices.map((index) => {
      invariant(!json.accessors[index].sparse, `Accessor ${index} unexpectedly uses sparse storage.`);
      return json.accessors[index].bufferView;
    }),
    ...imageIndices.map((index) => json.images[index].bufferView),
  ])].sort((a, b) => a - b);
  const bufferViewMap = remapList(bufferViewIndices);

  const physicalParts = [];
  const copiedPhysicalRanges = new Set();
  let physicalLength = 0;
  let virtualLength = 0;
  const appendPhysicalData = (data) => {
    const padding = align4(physicalLength) - physicalLength;
    if (padding) physicalParts.push(Buffer.alloc(padding));
    physicalLength += padding;
    invariant(data.length > 0, 'Cannot append an empty physical buffer range.');
    const newOffset = physicalLength;
    physicalParts.push(data);
    physicalLength += data.length;
    return newOffset;
  };
  const appendPhysicalRange = (offset, length) => {
    const rangeKey = `${offset}:${length}`;
    invariant(!copiedPhysicalRanges.has(rangeKey), `Physical source range ${rangeKey} is referenced twice.`);
    copiedPhysicalRanges.add(rangeKey);
    invariant(offset >= 0 && length > 0 && offset + length <= source.bin.length, `Physical source range ${rangeKey} is invalid.`);
    return appendPhysicalData(source.bin.subarray(offset, offset + length));
  };

  const bufferViews = bufferViewIndices.map((index) => {
    const view = structuredClone(json.bufferViews[index]);
    if (view.buffer === 0) {
      invariant(!view.extensions, `Direct bufferView ${index} unexpectedly has extensions.`);
      const encoded = reencodedBufferViews.get(index);
      if (encoded) {
        view.byteLength = encoded.length;
        view.byteOffset = appendPhysicalData(encoded);
      } else {
        view.byteOffset = appendPhysicalRange(view.byteOffset ?? 0, view.byteLength);
      }
      return view;
    }

    invariant(view.buffer === 1, `bufferView ${index} uses unexpected buffer ${view.buffer}.`);
    const meshopt = view.extensions?.EXT_meshopt_compression;
    invariant(meshopt?.buffer === 0, `bufferView ${index} is missing Meshopt compression data.`);
    virtualLength = align4(virtualLength);
    view.byteOffset = virtualLength;
    virtualLength += view.byteLength;
    meshopt.byteOffset = appendPhysicalRange(meshopt.byteOffset ?? 0, meshopt.byteLength);
    return view;
  });

  const binPadding = align4(physicalLength) - physicalLength;
  if (binPadding) physicalParts.push(Buffer.alloc(binPadding));
  physicalLength += binPadding;
  const bin = Buffer.concat(physicalParts, physicalLength);

  const meshes = meshIndices.map((index) => {
    const mesh = structuredClone(json.meshes[index]);
    mesh.primitives.forEach((primitive) => {
      primitive.indices = accessorMap.get(primitive.indices);
      primitive.material = materialMap.get(primitive.material);
      for (const semantic of Object.keys(primitive.attributes)) {
        primitive.attributes[semantic] = accessorMap.get(primitive.attributes[semantic]);
      }
    });
    return mesh;
  });

  const nodes = nodeIndices.map((index) => {
    const node = structuredClone(json.nodes[index]);
    node.mesh = meshMap.get(node.mesh);
    return node;
  });
  const accessors = accessorIndices.map((index) => {
    const accessor = structuredClone(json.accessors[index]);
    accessor.bufferView = bufferViewMap.get(accessor.bufferView);
    return accessor;
  });
  const images = imageIndices.map((index) => {
    const image = structuredClone(json.images[index]);
    image.bufferView = bufferViewMap.get(image.bufferView);
    return image;
  });
  const textures = textureIndices.map((index) => {
    const texture = structuredClone(json.textures[index]);
    texture.sampler = samplerMap.get(texture.sampler);
    texture.extensions.KHR_texture_basisu.source = imageMap.get(texture.extensions.KHR_texture_basisu.source);
    return texture;
  });
  materials.forEach((material) => remapMaterialTextureIndices(material, textureMap));

  json.scenes[0].nodes = nodeIndices.map((index) => nodeMap.get(index));
  json.nodes = nodes;
  json.meshes = meshes;
  json.materials = materials;
  json.textures = textures;
  json.images = images;
  json.samplers = samplerIndices.map((index) => structuredClone(json.samplers[index]));
  json.accessors = accessors;
  json.bufferViews = bufferViews;
  json.buffers[0].byteLength = bin.length;
  json.buffers[1].byteLength = align4(virtualLength);
  json.extensionsUsed = json.extensionsUsed.filter((name) => name !== 'KHR_materials_specular');
  json.extensionsRequired = json.extensionsRequired?.filter((name) => name !== 'KHR_materials_specular');
  json.asset.generator = `${json.asset.generator}; AFFLATUS CIC LOD builder`;

  const triangles = json.meshes.reduce((total, mesh) => {
    const primitive = mesh.primitives[0];
    return total + json.accessors[primitive.indices].count / 3;
  }, 0);
  invariant(json.nodes.length === 7 && json.meshes.length === 7, 'CIC LOD must contain seven nodes and meshes.');
  invariant(json.materials.length === 7, 'CIC LOD must contain seven materials.');
  invariant(json.textures.length === 18 && json.images.length === 18, 'CIC LOD must contain 18 retained KTX2 textures.');
  invariant(json.accessors.length === 33 && json.bufferViews.length === 46, 'CIC LOD dependency pruning is incomplete.');
  invariant(triangles === 105_142, `CIC LOD triangle count changed (${triangles}).`);
  invariant(!JSON.stringify(json).includes('KHR_materials_specular'), 'CIC LOD still contains KHR_materials_specular.');
  dropNodeNames.forEach((name) => invariant(!JSON.stringify(json).includes(name), `CIC LOD still contains removed node ${name}.`));

  return { json, bin, triangles };
}

function assertFighterSourceShape(json, bin) {
  invariant(json.scenes?.length === 1 && json.scene === 0, 'Expected one default fighter scene.');
  invariant(json.nodes?.length === 39 && json.meshes?.length === 5, 'Expected the 39-node, five-mesh fighter source.');
  invariant(json.materials?.length === 5 && json.textures?.length === 16 && json.images?.length === 16, 'Unexpected fighter material or texture layout.');
  invariant(json.samplers?.length === 1 && json.accessors?.length === 25 && json.bufferViews?.length === 37, 'Unexpected fighter dependency layout.');
  invariant(json.buffers?.length === 2 && json.buffers[0].byteLength === bin.length, 'Fighter physical buffer does not match its BIN chunk.');
  invariant(json.buffers[1].extensions?.EXT_meshopt_compression?.fallback === true, 'Fighter is missing its Meshopt fallback buffer.');
  invariant(!json.animations && !json.skins, 'Fighter CIC builder does not support animations or skins.');
  invariant(JSON.stringify(json.scenes[0].nodes) === JSON.stringify([0, 34, 35, 36, 37, 38]), 'Fighter scene roots changed.');
  invariant(json.nodes[0].name === '_rootJoint' && JSON.stringify(json.nodes[0].children) === '[1]', 'Fighter root hierarchy changed.');

  const expectedNozzles = [
    'nozzle_L_U_01',
    'nozzle_L_D_02',
    'nozzle_R_U_03',
    'nozzle_R_D_04',
    'nozzle_L_RU_017',
    'nozzle_R_RU_018',
    'nozzle_R_RD_019',
    'nozzle_L_RD_020',
  ].sort();
  const actualNozzles = json.nodes.map((node) => node.name).filter((name) => name.startsWith('nozzle_')).sort();
  invariant(JSON.stringify(actualNozzles) === JSON.stringify(expectedNozzles), 'Fighter nozzle anchor names changed.');
  invariant(expectedNozzles.every((name) => json.nodes[1].children.includes(json.nodes.findIndex((node) => node.name === name))), 'Fighter nozzle anchors left the body hierarchy.');
  invariant(JSON.stringify(json.meshes.map((mesh) => mesh.name)) === JSON.stringify([
    'body_mate2_0',
    'body_mate1_0',
    'body_mate5_0',
    'body_mate3_0',
    'body_mate4_0',
  ]), 'Fighter mesh names changed.');
  invariant(JSON.stringify(json.materials.map((material) => material.name)) === JSON.stringify(['mate2', 'mate1', 'mate5', 'mate3', 'mate4']), 'Fighter material names changed.');

  json.meshes.forEach((mesh, index) => {
    invariant(mesh.primitives?.length === 1, `Expected one primitive in fighter mesh ${index}.`);
    const primitive = mesh.primitives[0];
    invariant(primitive.mode === 4 && primitive.material === index && Number.isInteger(primitive.indices), `Unexpected primitive layout in fighter mesh ${index}.`);
    invariant(!primitive.targets, `Fighter mesh ${index} unexpectedly has morph targets.`);
  });
  json.images.forEach((image, index) => {
    const view = json.bufferViews[image.bufferView];
    const encoded = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    invariant(image.mimeType === 'image/ktx2' && view.buffer === 0 && !view.extensions, `Fighter image ${index} has an unexpected buffer layout.`);
    invariant(encoded.subarray(0, 12).equals(KTX2_IDENTIFIER), `Fighter image ${index} has an invalid KTX2 identifier.`);
    invariant(encoded.readUInt32LE(20) === 1024 && encoded.readUInt32LE(24) === 1024 && encoded.readUInt32LE(40) === 11, `Fighter image ${index} must be 1024px with 11 mips.`);
  });
  json.bufferViews.slice(16).forEach((view, index) => {
    invariant(view.buffer === 1 && view.extensions?.EXT_meshopt_compression?.buffer === 0, `Fighter geometry bufferView ${index + 16} is not Meshopt-compressed.`);
  });
  invariant(json.extensionsUsed?.includes('EXT_meshopt_compression') && json.extensionsUsed?.includes('KHR_texture_basisu'), 'Fighter source is missing required web extensions.');
}

async function buildFighterCic(source) {
  const json = structuredClone(source.json);
  assertFighterSourceShape(json, source.bin);
  const sourceNodes = JSON.stringify(json.nodes);
  const sourceMeshes = JSON.stringify(json.meshes);
  const sourceMaterials = JSON.stringify(json.materials);
  const sourceAccessors = JSON.stringify(json.accessors);

  const textureRoles = new Map();
  const alphaTextures = new Set();
  json.materials.forEach((material) => {
    const pbr = material.pbrMetallicRoughness;
    setTextureRole(textureRoles, pbr?.baseColorTexture?.index, 'baseColor');
    setTextureRole(textureRoles, material.normalTexture?.index, 'normal');
    setTextureRole(textureRoles, pbr?.metallicRoughnessTexture?.index, 'orm');
    invariant(!material.occlusionTexture, `${material.name} unexpectedly has a separate occlusion texture.`);
    if (material.alphaMode === 'BLEND') alphaTextures.add(pbr.baseColorTexture.index);
    if (material.emissiveTexture) setTextureRole(textureRoles, material.emissiveTexture.index, 'emissive');
  });
  invariant(textureRoles.size === 16, 'Expected all 16 fighter textures to have one material role.');
  invariant(alphaTextures.size === 1, 'Expected one alpha-bearing fighter base-color texture.');

  const imageRoles = new Map();
  for (const [textureIndex, role] of textureRoles) {
    const texture = json.textures[textureIndex];
    invariant(texture.extensions?.KHR_texture_basisu && texture.source === undefined, `Fighter texture ${textureIndex} is not BasisU-only.`);
    const imageIndex = texture.extensions.KHR_texture_basisu.source;
    const imageRole = { role, preserveAlpha: alphaTextures.has(textureIndex) };
    if (imageRoles.has(imageIndex)) {
      invariant(JSON.stringify(imageRoles.get(imageIndex)) === JSON.stringify(imageRole), `Shared fighter image ${imageIndex} has conflicting material roles.`);
    } else {
      imageRoles.set(imageIndex, imageRole);
    }
  }
  const reencodedImages = await reencodeTextures(json, source.bin, imageRoles, {
    label: 'fighter CIC',
    scratchPrefix: 'afflatus-fighter-cic-',
    sourceSize: 1024,
    targetSize: 512,
    roleCounts: { baseColor: 5, normal: 5, orm: 5, emissive: 1 },
    preserveRoles: [],
  });
  const reencodedBufferViews = new Map([...reencodedImages].map(([imageIndex, encoded]) => (
    [json.images[imageIndex].bufferView, encoded]
  )));

  const physicalParts = [];
  const copiedMeshoptRanges = new Set();
  let physicalLength = 0;
  let virtualLength = 0;
  const appendPhysicalData = (data) => {
    const padding = align4(physicalLength) - physicalLength;
    if (padding) physicalParts.push(Buffer.alloc(padding));
    physicalLength += padding;
    invariant(data.length > 0, 'Cannot append an empty fighter buffer range.');
    const offset = physicalLength;
    physicalParts.push(data);
    physicalLength += data.length;
    return offset;
  };

  json.bufferViews = json.bufferViews.map((sourceView, index) => {
    const view = structuredClone(sourceView);
    if (view.buffer === 0) {
      const encoded = reencodedBufferViews.get(index);
      invariant(encoded && !view.extensions, `Fighter texture bufferView ${index} was not re-encoded.`);
      view.byteOffset = appendPhysicalData(encoded);
      view.byteLength = encoded.length;
      return view;
    }

    invariant(view.buffer === 1, `Fighter bufferView ${index} uses unexpected buffer ${view.buffer}.`);
    const meshopt = view.extensions?.EXT_meshopt_compression;
    invariant(meshopt?.buffer === 0, `Fighter bufferView ${index} is missing Meshopt data.`);
    const rangeKey = `${meshopt.byteOffset ?? 0}:${meshopt.byteLength}`;
    invariant(!copiedMeshoptRanges.has(rangeKey), `Fighter Meshopt range ${rangeKey} is referenced twice.`);
    copiedMeshoptRanges.add(rangeKey);
    const encoded = source.bin.subarray(meshopt.byteOffset ?? 0, (meshopt.byteOffset ?? 0) + meshopt.byteLength);
    invariant(encoded.length === meshopt.byteLength, `Fighter Meshopt range ${rangeKey} is truncated.`);
    virtualLength = align4(virtualLength);
    view.byteOffset = virtualLength;
    virtualLength += view.byteLength;
    meshopt.byteOffset = appendPhysicalData(encoded);
    return view;
  });

  const padding = align4(physicalLength) - physicalLength;
  if (padding) physicalParts.push(Buffer.alloc(padding));
  physicalLength += padding;
  const bin = Buffer.concat(physicalParts, physicalLength);
  json.buffers[0].byteLength = bin.length;
  json.buffers[1].byteLength = align4(virtualLength);
  json.asset.generator = `${json.asset.generator}; AFFLATUS fighter CIC texture builder`;

  const triangles = json.meshes.reduce((total, mesh) => (
    total + json.accessors[mesh.primitives[0].indices].count / 3
  ), 0);
  invariant(triangles === 43_169, `Fighter CIC triangle count changed (${triangles}).`);
  invariant(JSON.stringify(json.nodes) === sourceNodes, 'Fighter CIC node hierarchy changed.');
  invariant(JSON.stringify(json.meshes) === sourceMeshes, 'Fighter CIC meshes changed.');
  invariant(JSON.stringify(json.materials) === sourceMaterials, 'Fighter CIC materials changed.');
  invariant(JSON.stringify(json.accessors) === sourceAccessors, 'Fighter CIC accessors changed.');
  return { json, bin, triangles };
}

function encodeGlb(json, bin) {
  const jsonSource = Buffer.from(JSON.stringify(json));
  const jsonLength = align4(jsonSource.length);
  const jsonChunk = Buffer.alloc(jsonLength, 0x20);
  jsonSource.copy(jsonChunk);
  const binLength = align4(bin.length);
  const binChunk = Buffer.alloc(binLength);
  bin.copy(binChunk);
  const totalLength = 12 + 8 + jsonLength + 8 + binLength;
  const output = Buffer.alloc(totalLength);
  output.write('glTF', 0, 4, 'ascii');
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonLength, 12);
  output.writeUInt32LE(JSON_CHUNK_TYPE, 16);
  jsonChunk.copy(output, 20);
  const binHeader = 20 + jsonLength;
  output.writeUInt32LE(binLength, binHeader);
  output.writeUInt32LE(BIN_CHUNK_TYPE, binHeader + 4);
  binChunk.copy(output, binHeader + 8);
  return output;
}

const source = parseGlb(await readFile(sourcePath));
const result = await buildCicLod(source);
const output = encodeGlb(result.json, result.bin);
invariant(output.length >= 2_600_000 && output.length <= 3_000_000, `CIC LOD is outside its expected 2.6-3.0 MB range (${output.length} bytes).`);
await writeFile(outputPath, output);
console.log(`built ${outputPath}`);
console.log(`${output.length} bytes, ${result.triangles} triangles, ${result.json.nodes.length} nodes, ${result.json.materials.length} materials, ${result.json.textures.length} textures`);

const fighterSource = parseGlb(await readFile(fighterSourcePath));
const fighterResult = await buildFighterCic(fighterSource);
const fighterOutput = encodeGlb(fighterResult.json, fighterResult.bin);
invariant(fighterOutput.length >= 850_000 && fighterOutput.length <= 1_100_000, `Fighter CIC is outside its expected 0.85-1.1 MB range (${fighterOutput.length} bytes).`);
await writeFile(fighterOutputPath, fighterOutput);
console.log(`built ${fighterOutputPath}`);
console.log(`${fighterOutput.length} bytes, ${fighterResult.triangles} triangles, ${fighterResult.json.nodes.length} nodes, ${fighterResult.json.materials.length} materials, ${fighterResult.json.textures.length} textures`);
