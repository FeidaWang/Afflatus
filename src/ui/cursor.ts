/**
 * Custom cursor controller — extracted from main.js (ROADMAP §3/§1 A2, Phase 4).
 * Wraps the single #cursor element's classList/style operations behind a small
 * API instead of letting five unrelated call sites (hover binding, comet
 * targeting box, main render loop position, market-deck hover, warp-hover on
 * the lang button) all poke el.classList directly. Pure DOM wrapper — no
 * combat/game state lives here, so this is a mechanical extraction, not a
 * behavior change. First .ts module in the codebase (C4, piggybacking on A2).
 */

export interface CursorTargetDir {
  left: boolean;
  above: boolean;
}

export interface CursorController {
  el: HTMLElement;
  setHot(on: boolean): void;
  setTargeting(dir: CursorTargetDir | null): void;
  setWarp(on: boolean): void;
  setPosition(x: number, y: number): void;
}

export function createCursor(el: HTMLElement): CursorController {
  return {
    el,
    setHot(on: boolean) {
      el.classList.toggle('hot', on);
    },
    setTargeting(dir: CursorTargetDir | null) {
      el.classList.remove('target-left', 'target-top', 'target-bottom');
      if (!dir) {
        el.classList.remove('targeting');
        return;
      }
      el.classList.toggle('target-left', dir.left);
      el.classList.toggle('target-top', dir.above);
      el.classList.toggle('target-bottom', !dir.above);
      el.classList.add('targeting');
    },
    setWarp(on: boolean) {
      el.classList.toggle('warp', on);
    },
    setPosition(x: number, y: number) {
      const scale = el.classList.contains('hot') ? 1.25 : 1;
      el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
    },
  };
}
