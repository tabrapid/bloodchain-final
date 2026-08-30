import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders its children text', () => {
    render(<StatusBadge>Active</StatusBadge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('defaults to the "default" variant styling', () => {
    render(<StatusBadge>Pending</StatusBadge>);
    expect(screen.getByText('Pending')).toHaveClass('text-donor-muted');
  });

  it('applies danger-variant styling when requested', () => {
    render(<StatusBadge variant="danger">Failed</StatusBadge>);
    // Text reads from the theme-shifted "on muted" token, not the raw brand
    // accent, so small badge text keeps 4.5:1 contrast against its own tint.
    expect(screen.getByText('Failed')).toHaveClass('text-donor-onDangerMuted');
  });

  it('merges a custom className alongside the variant classes', () => {
    render(
      <StatusBadge variant="success" className="ml-2">
        Delivered
      </StatusBadge>,
    );
    const badge = screen.getByText('Delivered');
    expect(badge).toHaveClass('ml-2');
    expect(badge).toHaveClass('text-donor-onSuccessMuted');
  });
});
