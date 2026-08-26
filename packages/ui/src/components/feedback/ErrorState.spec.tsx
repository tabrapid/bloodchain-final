import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders default title and description when none are given', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('does not render Retry or Back buttons when no handlers are given', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('renders and wires up the Retry button when onRetry is given', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders and wires up the Back button when onBack is given', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders both buttons when both handlers are given, independently wired', async () => {
    const onRetry = vi.fn();
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState onRetry={onRetry} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
