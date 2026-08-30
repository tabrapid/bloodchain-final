import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total units" value="128" />);
    expect(screen.getByText('Total units')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('does not render a note paragraph when none is given', () => {
    const { container } = render(<StatCard label="Total units" value="128" />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('renders the note when given', () => {
    render(<StatCard label="Total units" value="128" note="+12% vs last week" />);
    expect(screen.getByText('+12% vs last week')).toBeInTheDocument();
  });

  it('applies danger-variant tint styling', () => {
    const { container } = render(<StatCard label="Critical stock" value="0" variant="danger" />);
    // Variants tint the glass surface with the muted brand color rather than
    // swapping the border, so the card still reads as glass in every state.
    expect(container.firstElementChild).toHaveClass('bg-donor-dangerMuted');
  });
});
