import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider, LOCALE_KEY } from '@bloodchain/ui/i18n';

/**
 * Sprint 1A: the blood centre console speaks Uzbek.
 *
 * The sign-in screen is the one page every user of this console sees before
 * they can do anything, including change the language -- which is why the
 * switcher is on it and why an untranslated string here is worse than one four
 * clicks in. The navigation renders on the same screen, so both of the flows
 * this sprint covers for the portals are exercised by one render.
 */

// jsdom always reports en-US, and the provider is right to follow a browser it
// understands -- so the "defaults to Uzbek" branch only exists when the browser
// asks for something this product does not speak.
let mockPlatformLocales: string[] = ['de-DE'];
vi.mock('@bloodchain/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bloodchain/i18n')>();
  return { ...actual, detectPlatformLocales: () => mockPlatformLocales };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children }: { href: string; className?: string; children?: React.ReactNode }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('../lib/auth', () => ({
  isAuthenticated: () => false,
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

vi.mock('../lib/analytics', () => ({
  DateRangeType: { TODAY: 'TODAY' },
  getOverviewAnalytics: vi.fn(),
  getLaboratoryAnalytics: vi.fn(),
  getShipmentAnalytics: vi.fn(),
  getAlerts: vi.fn(),
}));

import BloodCenterDashboard from './page';
import { sidebarItems } from '../lib/navigation';

/** Renders the signed-out console and waits for its auth check to settle. */
async function renderSignIn() {
  const result = render(
    <LocaleProvider>
      <BloodCenterDashboard />
    </LocaleProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kirish' })).toBeInTheDocument());
  return result;
}

/**
 * Any catalogue path that reached the screen as text. A key renders as itself
 * when it is missing, so this is what "untranslated" looks like to a user.
 */
const RAW_KEY = /\b(?:common|auth|nav|language|units|validation|home|health|donate|calendar|community|profile|portal|address|medical|ops|status|table|actions|filters|booking|appointment|appointmentTypes|donationHistory|laboratory|healthTrends|insights|notifications|sos|campaigns|challenges|education|gamification|privacy|security|profileEdit|apiErrors)\.[A-Za-z][A-Za-z.]*/g;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.lang = '';
});

describe('blood centre console: language', () => {
  it('signs in in Uzbek by default', async () => {
    await renderSignIn();

    expect(
      screen.getByText('Qon markazi portali boshqaruv paneliga kirish'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Pochta')).toBeInTheDocument();
    expect(screen.getByLabelText('Parol')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parolni unutdingizmi?' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uz');
  });

  it('translates the navigation, not just the form', async () => {
    await renderSignIn();
    const nav = screen.getByRole('navigation');

    // Every declared entry, in Uzbek -- an untranslated one would show its
    // English fallback and still pass a "something is there" assertion.
    expect(nav).toHaveTextContent('Boshqaruv paneli');
    expect(nav).toHaveTextContent('Qon so‘rovlari');
    expect(nav).toHaveTextContent('Laboratoriya');
    expect(sidebarItems.every((item) => Boolean(item.labelKey))).toBe(true);
  });

  it('switches to Russian from the top bar and stays switched', async () => {
    const user = userEvent.setup();
    await renderSignIn();

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toHaveTextContent('Панель');
    expect(document.documentElement.lang).toBe('ru');
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe('ru');
  });

  it('opens in the language chosen last time', async () => {
    window.localStorage.setItem(LOCALE_KEY, 'en');
    render(
      <LocaleProvider>
        <BloodCenterDashboard />
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.getByRole('navigation')).toHaveTextContent('Blood Requests');
  });

  it('leaves no raw catalogue key on the screen, in any language', async () => {
    const user = userEvent.setup();
    const { container } = await renderSignIn();

    for (const language of ["O'zbekcha", 'Русский', 'English']) {
      await user.click(screen.getByRole('button', { name: language }));
      const leaked = container.textContent?.match(RAW_KEY) ?? [];
      expect({ language, leaked }).toEqual({ language, leaked: [] });
    }
  });
});
