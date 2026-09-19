import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider, LOCALE_KEY } from '@bloodchain/ui/i18n';

/**
 * Sprint 1A: the admin console speaks Uzbek.
 *
 * This console signs in on a bare card rather than inside the shell, so its
 * sign-in screen has no top bar to put a language switcher in -- it carries its
 * own. That is the whole point of the first test here: an admin who cannot read
 * English must be able to change the language *before* signing in, which is the
 * one moment the shell's switcher is not on screen.
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

vi.mock('@lib/auth', () => ({
  isAuthenticated: () => false,
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

vi.mock('@lib/api', () => ({
  getDashboard: vi.fn(),
  listOrganizations: vi.fn(),
  listEmergencies: vi.fn(),
  listAlerts: vi.fn(),
  getSystemHealth: vi.fn(),
}));

vi.mock('@lib/status', () => ({
  StatusBadgeWrapper: () => null,
}));

import AdminDashboard from './page';
import { AppShell } from '../components/AppShell';
import { navItems } from '@lib/navigation';

/** Renders the signed-out console and waits for its auth check to settle. */
async function renderSignIn() {
  const result = render(
    <LocaleProvider>
      <AdminDashboard />
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

describe('admin console: language', () => {
  it('signs in in Uzbek by default', async () => {
    await renderSignIn();

    expect(screen.getByRole('heading', { name: 'Administrator portali' })).toBeInTheDocument();
    expect(screen.getByText('Davom etish uchun kiring')).toBeInTheDocument();
    expect(screen.getByLabelText('Pochta')).toBeInTheDocument();
    expect(screen.getByLabelText('Parol')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uz');
  });

  it('offers the switcher on the sign-in card, where the top bar has not rendered yet', async () => {
    const user = userEvent.setup();
    await renderSignIn();

    await user.click(screen.getByRole('button', { name: 'Русский' }));

    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Портал администратора' })).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCALE_KEY)).toBe('ru');
  });

  it('opens in the language chosen last time', async () => {
    window.localStorage.setItem(LOCALE_KEY, 'en');
    render(
      <LocaleProvider>
        <AdminDashboard />
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Admin Portal' })).toBeInTheDocument();
  });

  it('translates the navigation, not just the sign-in form', () => {
    render(
      <LocaleProvider>
        <AppShell title="Dashboard">
          <p>body</p>
        </AppShell>
      </LocaleProvider>,
    );
    const nav = screen.getByRole('navigation');

    expect(nav).toHaveTextContent('Boshqaruv paneli');
    expect(nav).toHaveTextContent('Rollar va ruxsatlar');
    expect(nav).toHaveTextContent('Kontent moderatsiyasi');
    // Every entry carries a key: one without would silently stay English.
    expect(navItems.every((item) => Boolean(item.labelKey))).toBe(true);
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
