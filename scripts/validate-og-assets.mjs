#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  SITE_LOCALES,
  SITE_MANIFEST,
  SOCIAL_CARD,
  socialCardFilename,
} from '../src/config/siteManifest.js';
import { novelSocialCardPath } from '../src/lib/serialRoutes.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const activeRoutes = SITE_MANIFEST.filter((route) => route.status === 'active');
const failures = [];
const imageUrls = new Set();
let totalBytes = 0;

const fail = (asset, message) => failures.push(`${asset}: ${message}`);

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('not a JPEG file');
  }

  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;

    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3,
      0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb,
      0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }

  throw new Error('missing JPEG dimensions');
}

async function validateCard(route, locale) {
  const expectedPath = `/assets/og/${socialCardFilename(route.id, locale)}`;
  const url = route.seo.social.images[locale];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`${route.id}/${locale}`, `invalid URL ${JSON.stringify(url)}`);
    return;
  }

  if (parsed.origin !== 'https://feida.au') {
    fail(`${route.id}/${locale}`, `unexpected image origin ${parsed.origin}`);
  }
  if (parsed.pathname !== expectedPath) {
    fail(
      `${route.id}/${locale}`,
      `image path is ${parsed.pathname}, expected ${expectedPath}`,
    );
  }
  if (imageUrls.has(url)) {
    fail(`${route.id}/${locale}`, `duplicates social image ${url}`);
  }
  imageUrls.add(url);

  const relativePath = parsed.pathname.replace(/^\/+/, '');
  const filePath = path.join(ROOT, 'public', relativePath);
  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    fail(relativePath, `cannot read asset (${error.code || error.message})`);
    return;
  }

  totalBytes += buffer.length;
  if (buffer.length > SOCIAL_CARD.maxBytes) {
    fail(
      relativePath,
      `${buffer.length} bytes exceeds ${SOCIAL_CARD.maxBytes}-byte budget`,
    );
  }

  try {
    const dimensions = jpegDimensions(buffer);
    if (
      dimensions.width !== SOCIAL_CARD.width
      || dimensions.height !== SOCIAL_CARD.height
    ) {
      fail(
        relativePath,
        `${dimensions.width}×${dimensions.height}, expected ${SOCIAL_CARD.width}×${SOCIAL_CARD.height}`,
      );
    }
  } catch (error) {
    fail(relativePath, error.message);
  }
}

async function validateBackground(route) {
  const asset = route.seo.social.background;
  const filePath = path.join(ROOT, asset);
  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    fail(asset, `cannot read generation source (${error.code || error.message})`);
    return;
  }

  try {
    const dimensions = jpegDimensions(buffer);
    if (
      dimensions.width < SOCIAL_CARD.width
      || dimensions.height < SOCIAL_CARD.height
    ) {
      fail(
        asset,
        `${dimensions.width}×${dimensions.height} is smaller than the social card`,
      );
    }
  } catch (error) {
    fail(asset, error.message);
  }
}

for (const route of activeRoutes) {
  await validateBackground(route);
  for (const locale of SITE_LOCALES) await validateCard(route, locale);
}

// Novel cards: one per book and per chapter, drawn with the titles recorded
// in scripts/data/novel-og-cards.json, which must still match the books.
let novelCards = 0;
async function validateNovelCard(publicPath) {
  const relativePath = publicPath.replace(/^\/+/, '');
  let buffer;
  try {
    buffer = await readFile(path.join(ROOT, 'public', relativePath));
  } catch (error) {
    fail(relativePath, `cannot read novel card (${error.code || error.message}); run npm run og:generate`);
    return;
  }
  novelCards += 1;
  totalBytes += buffer.length;
  if (buffer.length > SOCIAL_CARD.maxBytes) {
    fail(relativePath, `${buffer.length} bytes exceeds ${SOCIAL_CARD.maxBytes}-byte budget`);
  }
  try {
    const dimensions = jpegDimensions(buffer);
    if (dimensions.width !== SOCIAL_CARD.width || dimensions.height !== SOCIAL_CARD.height) {
      fail(relativePath, `${dimensions.width}×${dimensions.height}, expected ${SOCIAL_CARD.width}×${SOCIAL_CARD.height}`);
    }
  } catch (error) {
    fail(relativePath, error.message);
  }
}

const novelsIndex = JSON.parse(await readFile(path.join(ROOT, 'public/novels-index.json'), 'utf8'));
let novelManifest = {};
try {
  novelManifest = JSON.parse(await readFile(path.join(ROOT, 'scripts/data/novel-og-cards.json'), 'utf8'));
} catch (error) {
  fail('scripts/data/novel-og-cards.json', `cannot read (${error.code || error.message}); run npm run og:generate`);
}
for (const entry of novelsIndex.novels || []) {
  const { chapters = [] } = JSON.parse(await readFile(path.join(ROOT, 'public/novels', `${entry.id}.json`), 'utf8'));
  const drawn = novelManifest[entry.id];
  if (drawn && drawn.title !== entry.novel.title) {
    fail(`novels/${entry.id}`, 'book card was drawn with an old title; run npm run og:generate');
  }
  if (drawn && Object.keys(drawn.chapters || {}).length !== chapters.length) {
    fail(`novels/${entry.id}`, 'chapter cards do not match the published chapter count; run npm run og:generate');
  }
  await validateNovelCard(novelSocialCardPath({ bookId: entry.id }));
  for (const chapter of chapters) {
    if (drawn && drawn.chapters?.[chapter.id] !== chapter.title) {
      fail(`novels/${entry.id}/${chapter.id}`, 'chapter card was drawn with a different title; run npm run og:generate');
    }
    await validateNovelCard(novelSocialCardPath({ bookId: entry.id, chapterId: chapter.id }));
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`FAIL: ${message}`));
  process.exit(1);
}

console.log(
  `OK: ${imageUrls.size} route social cards + ${novelCards} novel cards (${SOCIAL_CARD.width}×${SOCIAL_CARD.height}, ${(totalBytes / 1_000_000).toFixed(2)} MB total)`,
);
