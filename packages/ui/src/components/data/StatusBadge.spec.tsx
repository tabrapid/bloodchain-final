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
    expect(screen.getByText('Pending')).toHaveClass('text-[#8495A3]');
  });

  it('applies danger-variant styling when requested', () => {
    render(<StatusBadge variant="danger">Failed</StatusBadge>);
    expect(screen.getByText('Failed')).toHaveClass('text-[#D85360]');
  });

  it('merges a custom className alongside the variant classes', () => {
    render(
      <StatusBadge variant="success" className="ml-2">
        Delivered
      </StatusBadge>,
    );
    const badge = screen.getByText('Delivered');
    expect(badge).toHaveClass('ml-2');
    expect(badge).toHaveClass('text-[#63C29B]');
  });
});
