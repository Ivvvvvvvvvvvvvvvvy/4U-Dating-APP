import { useEffect } from 'react';

export function useDetailFocus(id: string) {
  useEffect(() => {
    document.getElementById(id)?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
        document.querySelector<HTMLButtonElement>('.detail-top button[aria-label="返回"]')?.click();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [id]);
}
