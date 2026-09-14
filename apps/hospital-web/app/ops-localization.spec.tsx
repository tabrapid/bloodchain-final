import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createLocalization, type Locale } from '@bloodchain/i18n';
import { LocaleProvider, LOCALE_KEY } from '@bloodchain/ui/i18n';

/**
 * Sprint 1C: an operations page, not just the sign-in screen.
 *
 * Sprint 1A proved the console's front door speaks Uzbek. This proves a page
 * behind it does too -- including the parts a catalogue test cannot see: badge
 * labels that used to live in a module-level STATUS_CONFIG, and filter options
 * whose words now come from the status enum on the row.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/shipments',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../lib/auth', () => ({
  isAuthenticated: () => true,
  me: vi.fn().mockResolvedValue({
    firstName: 'Test',
    lastName: 'User',
    roles: ['HOSPITAL_ADMIN'],
    organizations: [{ organizationId: 'org-1', type: 'HOSPITAL', name: 'Test Hospital' }],
  }),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../lib/shipments', () => ({
  getIncomingShipments: vi.fn().mockResolvedValue([
    {
      id: 's-1',
      shipmentReference: 'SHP-001',
      status: 'IN_TRANSIT',
      createdAt: '2026-09-01T10:00:00.000Z',
      units: [],
      bloodCenter: { id: 'bc-1', name: 'City Blood Center' },
      hospital: { id: 'org-1', name: 'Test Hospital' },
    },
  ]),
  confirmDelivery: vi.fn(),
  ApiRequestError: class extends Error {},
}));

import ShipmentsPage from './shipments/page';

/** A dotted path where a sentence should be: what a missing key looks like. */
const RAW_KEY =
  /\b(?:common|auth|nav|units|validation|portal|address|medical|ops|status|table|actions|filters)\.[A-Za-z][A-Za-z.]*/g;

async function renderPage(locale: Locale) {
  window.localStorage.setItem(LOCALE_KEY, locale);
  const result = render(
    <LocaleProvider>
      <ShipmentsPage />
    </LocaleProvider>,
  );
  await waitFor(() =>
    expect(screen.getByText(createLocalization(locale).t('ops.shipments.pageTitle'))).toBeInTheDocument(),
  );
  return result;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe.each<Locale>(['uz', 'ru', 'en'])('hospital shipments page in %s', (locale) => {
  const t = createLocalization(locale).t;

  it('renders its heading and its status badge in that language', async () => {
    await renderPage(locale);

    expect(screen.getByText(t('ops.shipments.pageTitle'))).toBeInTheDocument();
    // The badge word comes from the row's own status, resolved at render --
    // the case that a module-level label map got wrong for years.
    expect(screen.getAllByText(t('status.shipment.IN_TRANSIT')).length).toBeGreaterThan(0);
  });

  it('leaves no raw catalogue key on the page', async () => {
    const { container } = await renderPage(locale);
    const leaked = container.textContent?.match(RAW_KEY) ?? [];
    expect({ locale, leaked }).toEqual({ locale, leaked: [] });
  });
});

describe('switching language on an operations page', () => {
  it('re-renders the status words, not just the chrome', async () => {
    const user = userEvent.setup();
    await renderPage('uz');

    const uz = createLocalization('uz').t('status.shipment.IN_TRANSIT');
    const ru = createLocalization('ru').t('status.shipment.IN_TRANSIT');
    expect(uz).not.toBe(ru);
    expect(screen.getAllByText(uz).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    await waitFor(() => expect(screen.getAllByText(ru).length).toBeGreaterThan(0));
    expect(screen.queryByText(uz)).toBeNull();
  });
});
