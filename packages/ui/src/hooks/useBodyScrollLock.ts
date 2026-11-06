import { useEffect } from 'react';

let locks = 0;
let previous = '';
/** Dialogs may overlap; the last one closing restores the original page scroll. */
export function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    if (locks === 0) {
      previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) document.body.style.overflow = previous;
    };
  }, [open]);
}
