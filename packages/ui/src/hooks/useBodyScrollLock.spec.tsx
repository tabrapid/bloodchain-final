import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useBodyScrollLock } from './useBodyScrollLock';
function Lock() {
  useBodyScrollLock(true);
  return <div>dialog</div>;
}
it('keeps page scroll locked until the last overlapping dialog closes', () => {
  document.body.style.overflow = 'auto';
  const first = render(<Lock />),
    second = render(<Lock />);
  expect(document.body.style.overflow).toBe('hidden');
  first.unmount();
  expect(document.body.style.overflow).toBe('hidden');
  second.unmount();
  expect(document.body.style.overflow).toBe('auto');
  document.body.style.overflow = '';
});
