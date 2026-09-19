import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from './Topbar';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';

/**
 * The component now reads its words from the catalogue, so the assertions do
 * too: hard-coding English here would pass only while the default language
 * happened to be English.
 */
const { t } = createLocalization(DEFAULT_LOCALE);


/**
 * The Topbar renders each control only when given a handler for it, which is
 * the property that made P3-15's fix possible: dropping `onNotifications`
 * removes the bell rather than leaving a button that does nothing. Every
 * dashboard page passed `onNotifications={() => {}}` — 61 call sites, none of
 * which had anywhere to navigate to, since neither app has a notifications
 * route. These tests pin the conditional rendering so that stays true.
 */
describe('Topbar', () => {
  it('renders the title and subtitle', () => {
    render(<Topbar title="Shipments" subtitle="Blood Center" />);

    expect(screen.getByRole('heading', { name: 'Shipments' })).toBeInTheDocument();
    expect(screen.getByText('Blood Center')).toBeInTheDocument();
  });

  it('renders no controls at all when given no handlers', () => {
    render(<Topbar title="Shipments" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the notifications bell only when it has somewhere to go', () => {
    const onNotifications = vi.fn();
    const { rerender } = render(<Topbar title="Shipments" />);
    expect(screen.queryByRole('button', { name: t('portal.nav.notifications') })).not.toBeInTheDocument();

    rerender(<Topbar title="Shipments" onNotifications={onNotifications} />);
    expect(screen.getByRole('button', { name: t('portal.nav.notifications') })).toBeInTheDocument();
  });

  it('calls onLogout when the log out button is clicked', async () => {
    const onLogout = vi.fn();
    render(<Topbar title="Shipments" onLogout={onLogout} />);

    await userEvent.click(screen.getByRole('button', { name: t('portal.signOut') }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('reports each keystroke to onSearch', async () => {
    const onSearch = vi.fn();
    render(<Topbar title="Shipments" onSearch={onSearch} />);

    await userEvent.type(screen.getByPlaceholderText(t('actions.searchPlaceholder')), 'ab');

    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith('ab');
  });

  it("shows the user's initial and name when signed in", () => {
    render(<Topbar title="Shipments" userName="aziza karimova" />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('aziza karimova')).toBeInTheDocument();
  });

  it('shows no avatar when there is no user', () => {
    render(<Topbar title="Shipments" />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
