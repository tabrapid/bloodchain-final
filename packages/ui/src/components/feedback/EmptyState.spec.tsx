import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders default title and description when none are given', () => {
    render(<EmptyState />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('When data is available, it will appear here.')).toBeInTheDocument();
  });

  it('renders a custom title and description', () => {
    render(<EmptyState title="No shipments" description="Create one to get started." />);
    expect(screen.getByText('No shipments')).toBeInTheDocument();
    expect(screen.getByText('Create one to get started.')).toBeInTheDocument();
  });

  it('does not render an action wrapper when no action is given', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.mt-5')).toBeNull();
  });

  it('renders the given action node', () => {
    render(<EmptyState action={<button>Create campaign</button>} />);
    expect(screen.getByRole('button', { name: 'Create campaign' })).toBeInTheDocument();
  });
});
