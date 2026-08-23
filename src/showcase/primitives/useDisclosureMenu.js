import { useEffect, useState } from 'react';

export function useDisclosureMenu(triggerRef) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, triggerRef]);

  return {
    close: () => setOpen(false),
    open,
    toggle: () => setOpen((current) => !current),
  };
}
