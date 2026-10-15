// @vitest-environment jsdom
import { createElement } from 'react';
import { act } from 'preact/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/showcase/PremiereApp.jsx';
import { FILM_POSTER, FILM_SOURCE } from '../src/showcase/FilmPlayer.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function stubMedia({ reducedMotion = false, touch = false } = {}) {
  window.matchMedia = vi.fn((query) => ({
    matches: (reducedMotion && query.includes('prefers-reduced-motion')) || (touch && query.includes('pointer: coarse')),
    addEventListener() {},
    removeEventListener() {},
  }));
}

let root;
let container;
async function render(lang) {
  document.documentElement.lang = lang;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(App)));
  return container;
}

beforeEach(() => {
  stubMedia();
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('premiere homepage', () => {
  it('renders the English page with a skip link, one h1 and the film', async () => {
    const page = await render('en');
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('.skip-link').getAttribute('href')).toBe('#home-content');
    expect(page.querySelector('#home-content')).not.toBeNull();
    const film = page.querySelector('video.premiere-film');
    expect(film.getAttribute('src')).toBe(FILM_SOURCE);
    expect(film.getAttribute('poster')).toBe(FILM_POSTER);
    expect(film.autoplay).toBe(true);
    expect(page.querySelector('.film-inline-play').getAttribute('aria-label')).toMatch(/film/i);
  });

  it('links "Read the research" to the sectors evidence section that exists', async () => {
    const page = await render('en');
    const research = [...page.querySelectorAll('a')].find((link) => link.textContent.includes('Read the research'));
    expect(research.getAttribute('href')).toMatch(/\/sectors\.html#sources$/);
  });

  it('renders the Chinese page with Chinese copy and labels', async () => {
    const page = await render('zh-CN');
    expect(page.querySelector('h1').textContent).toContain('从这颗星球');
    expect(page.querySelector('video.premiere-film').getAttribute('aria-label')).toBe('AFFLATUS 宣传片');
  });

  it('does not autoplay the film for reduced-motion visitors', async () => {
    stubMedia({ reducedMotion: true });
    const page = await render('en');
    expect(page.querySelector('video.premiere-film').autoplay).toBe(false);
  });

  it('loads nothing until play on touch and small screens, and preloads metadata on desktop', async () => {
    stubMedia({ touch: true });
    const touch = (await render('en')).querySelector('video.premiere-film');
    expect(touch.autoplay).toBe(false);
    expect(touch.getAttribute('preload')).toBe('none');
    root.unmount(); container.remove();
    stubMedia();
    expect((await render('en')).querySelector('video.premiere-film').getAttribute('preload')).toBe('metadata');
  });
});
