import { describe, expect, it, vi } from 'vitest';
import { createFilmDrag } from '../src/showcase/filmMotion.js';

function fixture(position = null) {
  const win = new EventTarget(); win.innerWidth = 1280; win.innerHeight = 800;
  const element = new EventTarget();
  element.ownerDocument = { defaultView: win };
  element.style = { removeProperty(key) { delete this[key]; } };
  element.classList = { add: vi.fn(), remove: vi.fn() };
  element.getBoundingClientRect = () => ({ width: 360, height: 366 });
  element.setPointerCapture = vi.fn(); element.hasPointerCapture = () => true; element.releasePointerCapture = vi.fn();
  const emit = (type, props = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: { closest: selector => props.control ? selector.includes('button:not') : selector === '.film-drag-handle' && props.handle } });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0, ...props });
    element.dispatchEvent(event); return event;
  };
  const ctl = createFilmDrag(element, { position });
  return { win, element, emit, ctl };
}

describe('floating homepage film', () => {
  it('starts in the bottom right and stays inside the viewport after dragging', () => {
    const { element, emit, ctl } = fixture();
    expect([element.style.left, element.style.top]).toEqual(['904px', '418px']);
    emit('pointerdown', { clientX: 1000, clientY: 500 });
    emit('pointermove', { clientX: 650, clientY: 250 });
    expect([element.style.left, element.style.top]).toEqual(['554px', '168px']);
    emit('pointermove', { clientX: -2000, clientY: -2000 });
    expect([element.style.left, element.style.top]).toEqual(['16px', '16px']);
    emit('pointerup'); ctl.destroy();
  });
  it('keeps controls clickable and supports keyboard movement from the drag handle', () => {
    const { element, emit, ctl } = fixture();
    expect(emit('pointerdown', { control: true }).defaultPrevented).toBe(false);
    expect(element.setPointerCapture).not.toHaveBeenCalled();
    emit('keydown', { handle: true, key: 'ArrowLeft', shiftKey: true });
    expect(element.style.left).toBe('868px');
    emit('keydown', { handle: true, key: 'ArrowUp' }); expect(element.style.top).toBe('406px');
    ctl.destroy();
  });
  it('repositions a dragged card when its browser window shrinks', () => {
    const { win, element, ctl } = fixture({ x: 800, y: 400 });
    win.innerWidth = 390; win.innerHeight = 600; win.dispatchEvent(new Event('resize'));
    expect([element.style.left, element.style.top]).toEqual(['16px', '218px']);
    ctl.destroy();
  });
  it('ends cancelled drags and releases listeners and positioning when restored', () => {
    const { element, emit, ctl, win } = fixture();
    emit('pointerdown'); emit('pointercancel');
    const left = element.style.left;
    emit('pointermove', { clientX: 100 }); expect(element.style.left).toBe(left);
    ctl.destroy(); win.dispatchEvent(new Event('resize')); emit('pointerdown');
    expect(element.style.left).toBeUndefined();
    expect(element.setPointerCapture).toHaveBeenCalledTimes(1);
  });
});
