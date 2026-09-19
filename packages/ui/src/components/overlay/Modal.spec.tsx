import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';

/**
 * The component now reads its words from the catalogue, so the assertions do
 * too: hard-coding English here would pass only while the default language
 * happened to be English.
 */
const { t } = createLocalization(DEFAULT_LOCALE);


/**
 * P3-16. The Modal had no tests, and two gaps that only show up when you try
 * to use it: nothing identified it to assistive tech as a dialog, and Escape
 * did nothing — the only ways out were the mouse (overlay or the X), so a
 * keyboard user was stuck inside it.
 */
describe('Modal', () => {
  it('renders nothing at all when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        <p>body</p>
      </Modal>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('exposes itself as a modal dialog labelled by its title', () => {
    render(
      <Modal open onClose={vi.fn()} title="Suspend courier" description="This can be undone.">
        <p>body</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Suspend courier' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('This can be undone.')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('is still a findable dialog when it has no title', () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        <p>body</p>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not listen for Escape while closed', async () => {
    const onClose = vi.fn();
    render(
      <Modal open={false} onClose={onClose} title="Confirm">
        <p>body</p>
      </Modal>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted, so a stale handler cannot fire', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal open onClose={onClose} title="Confirm">
        <p>body</p>
      </Modal>,
    );

    unmount();
    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the X button and from the overlay', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="Confirm">
        <p>body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByRole('button', { name: t('common.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(container.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders a footer only when given one', () => {
    const { rerender } = render(
      <Modal open onClose={vi.fn()} title="Confirm">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    rerender(
      <Modal open onClose={vi.fn()} title="Confirm" footer={<button>Save</button>}>
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
