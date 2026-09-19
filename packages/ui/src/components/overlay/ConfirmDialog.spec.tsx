import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';

import { ConfirmDialog } from './ConfirmDialog';

const { t } = createLocalization(DEFAULT_LOCALE);

/**
 * Every irreversible action in the three consoles goes through this dialog.
 *
 * It replaced `window.confirm()` and `window.prompt()`, which had four defects
 * these tests hold shut: a prompt could not tell a cancelled dialog from an
 * empty answer, so pressing Escape discarded a unit; nothing showed *which*
 * row was about to change; nothing said the action was permanent; and a
 * server refusal went to a separate box, losing what the operator had typed.
 */
describe('ConfirmDialog', () => {
  const base = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Discard this unit?',
    confirmLabel: 'Discard',
  };

  it('will not confirm until a required reason is given', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        {...base}
        onConfirm={onConfirm}
        reason={{ required: true, label: 'Why is it being discarded?' }}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Discard' });
    expect(confirm).toBeDisabled();

    // Whitespace is not a reason.
    await user.type(screen.getByLabelText('Why is it being discarded?'), '   ');
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText('Why is it being discarded?'), 'Broken seal');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('Broken seal');
  });

  it('confirms without a reason when the action does not need one', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(<ConfirmDialog {...base} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('says plainly that a danger action cannot be undone', () => {
    const { rerender } = render(<ConfirmDialog {...base} tone="danger" />);
    expect(screen.getByText(t('actions.cannotBeUndone'))).toBeInTheDocument();

    rerender(<ConfirmDialog {...base} tone="default" />);
    expect(screen.queryByText(t('actions.cannotBeUndone'))).toBeNull();
  });

  it('shows which row is being acted on', () => {
    render(<ConfirmDialog {...base} context="BU-2026-0001 · O- Whole blood" />);
    expect(screen.getByText('BU-2026-0001 · O- Whole blood')).toBeInTheDocument();
  });

  it('reports a server refusal inside the dialog, keeping what was typed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConfirmDialog {...base} reason={{ required: true, label: 'Reason' }} />,
    );

    await user.type(screen.getByLabelText('Reason'), 'Broken seal');
    rerender(
      <ConfirmDialog
        {...base}
        reason={{ required: true, label: 'Reason' }}
        error="Unit is already discarded."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unit is already discarded.');
    expect(screen.getByLabelText('Reason')).toHaveValue('Broken seal');
  });

  it('does not let the action be fired twice while it is running', () => {
    render(<ConfirmDialog {...base} loading />);
    expect(screen.getByRole('button', { name: t('ops.common.working') })).toBeDisabled();
  });

  it('clears a previous row’s reason when it is reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ConfirmDialog {...base} reason={{ required: true, label: 'Reason' }} />,
    );

    await user.type(screen.getByLabelText('Reason'), 'Broken seal');
    rerender(<ConfirmDialog {...base} open={false} reason={{ required: true, label: 'Reason' }} />);
    rerender(<ConfirmDialog {...base} open reason={{ required: true, label: 'Reason' }} />);

    expect(screen.getByLabelText('Reason')).toHaveValue('');
  });

  it('prefills the usual answer for a quantity, still editable', () => {
    render(
      <ConfirmDialog
        {...base}
        reason={{ required: true, type: 'number', defaultValue: '450', label: 'Volume (mL)' }}
      />,
    );

    const field = screen.getByLabelText('Volume (mL)');
    expect(field).toHaveAttribute('type', 'number');
    expect(field).toHaveValue(450);
  });
});
