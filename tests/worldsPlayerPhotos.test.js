import { describe, it, expect } from 'vitest';
import { PLAYER_PHOTOS, photoFor, playerSlug } from '../src/lib/worldsPlayerPhotos.js';

describe('playerSlug', () => {
  it('lower-cases and strips everything but letters and digits', () => {
    expect(playerSlug('Kiin')).toBe('kiin');
    expect(playerSlug('Hope ')).toBe('hope');
    expect(playerSlug('Dr. X')).toBe('drx');
    expect(playerSlug('Hans Sama')).toBe('hanssama');
  });
});

describe('PLAYER_PHOTOS', () => {
  it('records an official https photo and its Leaguepedia source page for every entry', () => {
    const entries = Object.entries(PLAYER_PHOTOS);
    expect(entries.length).toBeGreaterThan(40);
    for (const [slug, { src, sourceUrl }] of entries) {
      expect(slug).toBe(playerSlug(slug));
      expect(src).toMatch(/^https:\/\/static\.wikia\.nocookie\.net\/lolesports_gamepedia_en\/images\/.+\/scale-to-width-down\/96/);
      expect(sourceUrl).toMatch(/^https:\/\/lol\.fandom\.com\/wiki\//);
    }
  });
});

describe('photoFor', () => {
  it('finds a photo by display name regardless of case', () => {
    expect(photoFor('CHOVY')).toEqual(PLAYER_PHOTOS.chovy);
  });

  it('returns null for an unknown player', () => {
    expect(photoFor('nobody')).toBeNull();
    expect(photoFor(undefined)).toBeNull();
  });
});
