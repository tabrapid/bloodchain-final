import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';
import { WorkspaceToolbar } from './WorkspaceToolbar';
const { t } = createLocalization(DEFAULT_LOCALE);
describe('WorkspaceToolbar', () => {
  it('toggles density and exposes the selected state to assistive technology', async () => {
    const onCompactChange = vi.fn();
    const { rerender } = render(
      <WorkspaceToolbar
        compact={false}
        onCompactChange={onCompactChange}
        organizationName="Tashkent"
      />,
    );
    const button = screen.getByRole('button', { name: t('clinical.compact') });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(onCompactChange).toHaveBeenCalledWith(true);
    rerender(<WorkspaceToolbar compact onCompactChange={onCompactChange} />);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
  it('opens the native print flow', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<WorkspaceToolbar compact={false} onCompactChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: t('clinical.print') }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
