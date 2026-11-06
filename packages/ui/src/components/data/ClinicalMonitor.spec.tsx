import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';
import { ClinicalMonitor } from './ClinicalMonitor';

const { t } = createLocalization(DEFAULT_LOCALE);
const data = {
  laboratory: { totalTests: 20, completedTests: 15, pendingTests: 5 },
  inventory: { totalUnits: 100, availableUnits: 70, reservedUnits: 20, quarantinedUnits: 10 },
  shipments: { active: 6, delivered: 12, delayed: 2 },
};
describe('ClinicalMonitor', () => {
  it('calculates completion from API counts and links to the underlying worklists', () => {
    render(<ClinicalMonitor {...data} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(`${t('clinical.completion')}: 75%`);
    expect(screen.getByRole('link', { name: t('clinical.laboratory') })).toHaveAttribute(
      'href',
      '/laboratory',
    );
    expect(screen.getByRole('link', { name: t('clinical.inventory') })).toHaveAttribute(
      'href',
      '/inventory',
    );
    expect(screen.getByRole('link', { name: t('clinical.distribution') })).toHaveAttribute(
      'href',
      '/shipments',
    );
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('2').closest('.bc-distribution-row')).toHaveClass('bc-delayed');
  });
  it('does not show missing or zero-test data as a healthy completed laboratory', () => {
    const { rerender } = render(
      <ClinicalMonitor laboratory={null} inventory={null} shipments={null} />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      `${t('clinical.completion')}: ${t('clinical.noData')}`,
    );
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    rerender(
      <ClinicalMonitor
        {...data}
        laboratory={{ totalTests: 0, completedTests: 0, pendingTests: 0 }}
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName(
      `${t('clinical.completion')}: ${t('clinical.noData')}`,
    );
  });
  it('masks retained results while a refresh is loading', () => {
    render(<ClinicalMonitor {...data} loading />);
    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('70')).not.toBeInTheDocument();
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });
});
