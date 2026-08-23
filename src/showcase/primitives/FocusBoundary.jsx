import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function FocusBoundary({
  as: Element = 'section',
  bodyClass,
  children,
  initialFocusRef,
  onDismiss,
  returnFocusRef,
  ...props
}) {
  const boundaryRef = useRef(null);
  const returnFrameRef = useRef(null);

  useEffect(() => {
    window.cancelAnimationFrame(returnFrameRef.current);
    if (bodyClass) document.body.classList.add(bodyClass);
    initialFocusRef?.current?.focus();

    return () => {
      if (bodyClass) document.body.classList.remove(bodyClass);
      returnFrameRef.current = window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
    };
  }, [bodyClass, initialFocusRef, returnFocusRef]);

  const handleKeyDown = (event) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...(boundaryRef.current?.querySelectorAll(FOCUSABLE) || [])];
    if (!focusable.length) {
      event.preventDefault();
      boundaryRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <Element {...props} ref={boundaryRef} onKeyDown={handleKeyDown}>
      {children}
    </Element>
  );
}
