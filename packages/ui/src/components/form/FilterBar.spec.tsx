import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders each control it is given', () => {
    render(
      <FilterBar>
        <button>Status</button>
        <button>Blood type</button>
      </FilterBar>,
    );

    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blood type' })).toBeInTheDocument();
  });

  it('merges a caller class onto its own', () => {
    const { container } = render(
      <FilterBar className="mb-8">
        <span>child</span>
      </FilterBar>,
    );

    const root = container.firstElementChild!;
    expect(root.className).toContain('mb-8');
    expect(root.className).toContain('flex-wrap');
  });
});
