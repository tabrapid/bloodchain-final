import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';

/**
 * The component now reads its words from the catalogue, so the assertions do
 * too: hard-coding English here would pass only while the default language
 * happened to be English.
 */
const { t } = createLocalization(DEFAULT_LOCALE);


describe('EmptyState', () => {
  it('renders default title and description when none are given', () => {
    render(<EmptyState />);
    expect(screen.getByText(t('common.nothingHere'))).toBeInTheDocument();
    expect(screen.getByText(t('common.nothingHereHint'))).toBeInTheDocument();
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
