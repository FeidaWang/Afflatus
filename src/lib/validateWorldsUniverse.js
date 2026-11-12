/* Publication contract for the bilingual Universe catalogue and its local
 * asset inventory. Related champions outside the curated selection are valid
 * official-link destinations; regional membership must resolve locally. */
const ASSET_ROOT = '/worlds-universe/assets/';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET_ID = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const RIOT_DOMAINS = ['leagueoflegends.com', 'riotgames.com', 'rgpub.io', 'lolesports.com'];
const LOCALES = ['en', 'zh'];

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const positiveInteger = (value) => Number.isInteger(value) && value > 0;
const result = (errors) => ({ ok: errors.length === 0, errors });

function requireText(value, tag, errors) {
  if (!text(value)) errors.push(`${tag}: must be a non-empty string`);
}

function bilingual(value, tag, errors, paragraphs = false) {
  for (const locale of LOCALES) {
    const entry = object(value) ? value[locale] : undefined;
    if (paragraphs) {
      if (!Array.isArray(entry) || entry.length !== 2 || !entry.every(text)) {
        errors.push(`${tag}.${locale}: must contain two non-empty paragraphs`);
      }
    } else requireText(entry, `${tag}.${locale}`, errors);
  }
}

function officialSource(value, tag, errors) {
  try {
    const url = new URL(value);
    if (typeof value !== 'string' || url.protocol !== 'https:' || url.username || url.password || url.port
      || !RIOT_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      throw new Error('untrusted source');
    }
  } catch {
    errors.push(`${tag}: must be an HTTPS URL on an official Riot domain`);
  }
}

function localAsset(value, tag, errors, relative = false) {
  const path = relative && typeof value === 'string' && value.startsWith('assets/')
    ? `/worlds-universe/${value}` : value;
  const parts = typeof path === 'string' && path.startsWith(ASSET_ROOT)
    ? path.slice(ASSET_ROOT.length).split('/') : [];
  // Reject encodings, query strings, backslashes and dot segments before any
  // URL or filesystem normalization can disguise a traversal attempt.
  if (!parts.length || (relative && (typeof value !== 'string' || !value.startsWith('assets/')))
    || parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part) || part === '.' || part === '..')
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/.test(parts.at(-1))) {
    errors.push(`${tag}: must be a local ${relative ? 'assets/' : ASSET_ROOT} file path without traversal`);
  }
}

function collection(value, tag, errors, idPattern = SLUG) {
  if (!Array.isArray(value) || !value.length) {
    errors.push(`${tag}: must be a non-empty array`);
    return [];
  }
  const seen = new Set();
  return value.flatMap((entry, index) => {
    const label = `${tag}[${index}]`;
    if (!object(entry)) { errors.push(`${label}: must be an object`); return []; }
    if (!text(entry.id) || !idPattern.test(entry.id)) errors.push(`${label}.id: must be a valid slug`);
    if (seen.has(entry.id)) errors.push(`${label}.id: duplicate ${entry.id}`);
    seen.add(entry.id);
    return [{ entry, tag: label }];
  });
}

function relatedChampions(value, tag, errors) {
  if (!Array.isArray(value)) { errors.push(`${tag}: must be a champion slug array`); return []; }
  const seen = new Set();
  value.forEach((id, index) => {
    if (typeof id !== 'string' || !SLUG.test(id)) errors.push(`${tag}[${index}]: must be a valid champion slug`);
    if (seen.has(id)) errors.push(`${tag}[${index}]: duplicate ${id}`);
    seen.add(id);
  });
  return value;
}

function sources(entry, tag, errors) {
  for (const key of ['sourceUrl', 'sourceImageUrl']) officialSource(entry[key], `${tag}.${key}`, errors);
  for (const key of ['dataUrl', 'localizedDataUrl', 'assetDataUrl']) {
    if (entry[key] !== undefined) officialSource(entry[key], `${tag}.${key}`, errors);
  }
}

function regionReference(value, tag, regions, errors) {
  if (!regions.has(value)) errors.push(`${tag}: unknown region ${JSON.stringify(value)}`);
}

function galleryItem(entry, tag, regions, errors) {
  if (!object(entry)) { errors.push(`${tag}: must be an object`); return; }
  requireText(entry.title, `${tag}.title`, errors);
  localAsset(entry.url, `${tag}.url`, errors);
  localAsset(entry.thumbnail, `${tag}.thumbnail`, errors);
  regionReference(entry.region, `${tag}.region`, regions, errors);
  sources(entry, tag, errors);
}

export function validateWorldsUniverse(data) {
  const errors = [];
  if (!object(data)) return result(['top-level: must be an object']);
  const groups = Object.fromEntries(['regions', 'champions', 'stories', 'skinUniverses', 'artGallery']
    .map((key) => [key, collection(data[key], key, errors)]));
  const regions = new Set(groups.regions.map(({ entry }) => entry.id));
  const champions = new Map(groups.champions.map(({ entry }) => [entry.id, entry]));

  if (data.meta?.assetBasePath !== ASSET_ROOT) errors.push(`meta.assetBasePath: must be ${ASSET_ROOT}`);
  if (data.meta?.assetManifest !== 'assets-manifest.json') errors.push('meta.assetManifest: must be assets-manifest.json');
  if (data.meta?.localArtCount !== groups.artGallery.length) errors.push('meta.localArtCount: must match artGallery length');

  for (const group of ['regions', 'champions', 'stories', 'skinUniverses']) {
    for (const { entry, tag } of groups[group]) {
      bilingual(entry[group === 'stories' ? 'title' : 'name'], `${tag}.${group === 'stories' ? 'title' : 'name'}`, errors);
      bilingual(entry.summary, `${tag}.summary`, errors);
      bilingual(entry.detail, `${tag}.detail`, errors, true);
      for (const key of ['image', 'thumbnail']) localAsset(entry[key], `${tag}.${key}`, errors);
      for (const key of ['imageWidth', 'imageHeight']) {
        if (!positiveInteger(entry[key])) errors.push(`${tag}.${key}: must be a positive integer`);
      }
      sources(entry, tag, errors);
      relatedChampions(entry.relatedChampions, `${tag}.relatedChampions`, errors);
      if (group === 'champions' || group === 'stories') regionReference(entry.region, `${tag}.region`, regions, errors);
    }
  }

  for (const { entry, tag } of groups.regions) {
    bilingual(entry.tagline, `${tag}.tagline`, errors);
    localAsset(entry.crest, `${tag}.crest`, errors);
    if (entry.video != null) localAsset(entry.video, `${tag}.video`, errors);
    for (const id of Array.isArray(entry.relatedChampions) ? entry.relatedChampions : []) {
      if (!champions.has(id)) errors.push(`${tag}.relatedChampions: unknown curated champion ${id}`);
      else if (champions.get(id).region !== entry.id) errors.push(`${tag}.relatedChampions: ${id} does not belong to ${entry.id}`);
    }
    if (!Array.isArray(entry.gallery)) errors.push(`${tag}.gallery: must be an array`);
    else entry.gallery.forEach((art, index) => {
      galleryItem(art, `${tag}.gallery[${index}]`, regions, errors);
      if (object(art) && art.region !== entry.id) errors.push(`${tag}.gallery[${index}].region: must match parent region`);
    });
  }

  for (const { entry, tag } of groups.champions) {
    bilingual(entry.title, `${tag}.title`, errors);
    localAsset(entry.portrait, `${tag}.portrait`, errors);
    if (!text(entry.ddragonId) || !/^[A-Za-z0-9]+$/.test(entry.ddragonId)) errors.push(`${tag}.ddragonId: must be a Data Dragon identifier`);
    if (!Array.isArray(entry.roles) || !entry.roles.length || !entry.roles.every(text)) errors.push(`${tag}.roles: must be a non-empty string array`);
    if (Array.isArray(entry.relatedChampions) && entry.relatedChampions.includes(entry.id)) errors.push(`${tag}.relatedChampions: must not refer to itself`);
  }

  for (const { entry, tag } of groups.stories) {
    requireText(entry.author, `${tag}.author`, errors);
    if (!positiveInteger(entry.minutes)) errors.push(`${tag}.minutes: must be a positive integer`);
    const links = entry.sourceLinks;
    if (!Array.isArray(links) || links.length !== 2 || !LOCALES.every((locale) => links.filter((link) => link?.locale === locale).length === 1)) {
      errors.push(`${tag}.sourceLinks: must contain one en and one zh source`);
    }
    if (Array.isArray(links)) links.forEach((link, index) => officialSource(link?.url, `${tag}.sourceLinks[${index}].url`, errors));
  }

  for (const { entry, tag } of groups.skinUniverses) {
    if (!['alternate-universe', 'runeterra-folklore'].includes(entry.kind)) errors.push(`${tag}.kind: unknown world classification`);
    if (entry.id === 'spirit-blossom' && entry.kind !== 'runeterra-folklore') errors.push(`${tag}.kind: Spirit Blossom must remain runeterra-folklore`);
    for (const key of ['champion', 'skinName']) requireText(entry[key], `${tag}.${key}`, errors);
    if (!Number.isInteger(entry.skinNum) || entry.skinNum < 0) errors.push(`${tag}.skinNum: must be a non-negative integer`);
  }

  // Gallery captions have bilingual names, not the editorial essay fields.
  for (const { entry, tag } of groups.artGallery) {
    bilingual(entry.name, `${tag}.name`, errors);
    galleryItem(entry, tag, regions, errors);
  }
  return result(errors);
}

export function validateWorldsUniverseManifest(data) {
  const errors = [];
  if (!object(data)) return result(['top-level: must be an object']);
  officialSource(data.source_site, 'source_site', errors);
  requireText(data.copyright, 'copyright', errors);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.downloaded_at ?? '') || !Number.isFinite(Date.parse(data.downloaded_at))) errors.push('downloaded_at: must be a valid YYYY-MM-DD date');
  if (!/^\d+\.\d+\.\d+$/.test(data.data_dragon_version ?? '')) errors.push('data_dragon_version: must be a version number');
  if (!Array.isArray(data.failed) || data.failed.length !== 0) errors.push('failed: must be an empty array before publication');
  const paths = new Set();
  const file = (entry, tag) => {
    if (!object(entry)) { errors.push(`${tag}: must be a file object`); return; }
    localAsset(entry.path, `${tag}.path`, errors, true);
    if (paths.has(entry.path)) errors.push(`${tag}.path: duplicate ${entry.path}`);
    paths.add(entry.path);
    if (!positiveInteger(entry.bytes)) errors.push(`${tag}.bytes: must be a positive integer`);
    for (const key of ['width', 'height']) {
      if (entry[key] !== undefined && !positiveInteger(entry[key])) errors.push(`${tag}.${key}: must be a positive integer`);
    }
  };
  for (const { entry, tag } of collection(data.assets, 'assets', errors, ASSET_ID)) {
    file(entry, tag);
    officialSource(entry.source_url, `${tag}.source_url`, errors);
    if (!/^[0-9a-f]{64}$/.test(entry.sha256_source ?? '')) errors.push(`${tag}.sha256_source: must be a SHA-256 digest`);
    requireText(entry.title, `${tag}.title`, errors);
    if (typeof entry.category !== 'string' || !SLUG.test(entry.category)
      || typeof entry.path !== 'string' || !entry.path.startsWith(`assets/${entry.category}/`)) {
      errors.push(`${tag}.category: must match the local asset directory`);
    }
    if (entry.thumbnail !== undefined) file(entry.thumbnail, `${tag}.thumbnail`);
  }
  return result(errors);
}
