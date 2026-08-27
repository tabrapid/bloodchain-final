import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Drawer } from './Drawer';

/** P3-16. Same two gaps as Modal — see that spec. */
describe('Drawer', () => {
  it('renders nothing at all when closed', () => {
    const { container } = render(
      <Drawer open={false} onClose={vi.fn()} title="Details">
        <p>body</p>
      </Drawer>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('exposes itself as a modal dialog labelled by its title', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Shipment details">
        <p>body</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog', { name: 'Shipment details' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Details">
        <p>body</p>
      </Drawer>,
    );

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stops listening once unmounted', async () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Drawer open onClose={onClose} title="Details">
        <p>body</p>
      </Drawer>,
    );

    unmount();
    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the X button and the overlay', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open onClose={onClose} title="Details">
        <p>body</p>
      </Drawer>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(container.querySelector('[aria-hidden="true"]')!);

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders a footer only when given one', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Details" footer={<button>Apply</button>}>
        <p>body</p>
      </Drawer>,
    );

    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});
