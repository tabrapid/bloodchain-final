/**
 * Every screen this app has, and every state worth photographing.
 *
 * The ids double as directory names, so they are grouped the way the app is:
 * auth/, onboarding/, tabs/, sos/, booking/, lab-booking/, health/, history/,
 * community/, account/, courier/.
 *
 * Routes carry their group (`/(booking)/date` rather than `/date`) on purpose.
 * Expo Router strips group folders from URLs, and this app has three collisions
 * once they are stripped -- (booking)/date and (lab-booking)/date, both review
 * and confirmation steps, (app)/laboratory and (lab-booking)/laboratory,
 * (app)/profile and (courier)/profile. The group-qualified path is the only
 * unambiguous way to ask for one of them.
 */
import { SOS, tracking, COURIER } from './fixtures.mjs';

/**
 * Press a control, by its accessible name first.
 *
 * react-native-web puts `accessibilityLabel` on the DOM node as `aria-label`,
 * which is exactly the string a screen reader would announce -- so a selector
 * written against it tests the same thing the accessibility contract promises.
 * Visible text is the fallback, for controls whose label is their text.
 */
const tap = (name, options = {}) => async (page) => {
  const byName = page.getByRole('button', { name, exact: false }).first();
  const byText = page.getByText(name, { exact: false }).first();
  const target = (await byName.count()) ? byName : byText;
  await target.waitFor({ state: 'visible', timeout: options.timeout ?? 6000 });
  await target.click({ force: true });
  await page.waitForTimeout(options.after ?? 600);
};

/**
 * Step through a wizard until a named control shows up, then press it.
 *
 * A step that asks a question will not let Continue through until it is
 * answered, so each turn answers with the first option offered before trying
 * again. That is enough for this wizard; it is not a general-purpose robot.
 */
const walkTo = (name, max = 10) => async (page) => {
  for (let step = 0; step < max; step += 1) {
    const target = page.getByRole('button', { name, exact: false }).first();
    if (await target.count()) {
      await target.click({ force: true });
      await page.waitForTimeout(900);
      return;
    }

    const next = page.getByRole('button', { name: 'Continue', exact: false }).first();
    if (!(await next.count())) break;

    if (await next.isDisabled().catch(() => false)) {
      const option = page.locator('[role="radio"]').first();
      if (await option.count()) {
        await option.click({ force: true });
        await page.waitForTimeout(350);
      }
      const fields = page.locator('input:not([type="hidden"])');
      for (let i = 0; i < (await fields.count()); i += 1) {
        const field = fields.nth(i);
        if (!(await field.inputValue().catch(() => 'x'))) {
          await field.fill(i === 0 ? 'Sample' : 'Donor').catch(() => {});
        }
      }
      await page.waitForTimeout(300);
    }
    await next.click({ force: true });
    await page.waitForTimeout(800);
  }
  throw new Error(`walkTo: never reached "${name}"`);
};

const type = (placeholder, value) => async (page) => {
  const field = page.getByPlaceholder(placeholder, { exact: false }).first();
  await field.waitFor({ state: 'visible', timeout: 6000 });
  await field.fill(value);
  await page.waitForTimeout(200);
};

const sequence =
  (...steps) =>
  async (page) => {
    for (const step of steps) await step(page);
  };

const FAIL = { status: 500, message: 'The server could not complete the request.' };

export function buildCatalogue(ids) {
  const booking = `organizationId=${ids.organizationId}&type=BLOOD_DONATION`;
  const labBooking = `testTypeId=${ids.testTypeId}&laboratoryId=${ids.laboratoryId}`;

  return [
    /* ---------------------------------------------------------- auth -- */
    {
      id: 'auth/welcome',
      title: 'Welcome',
      url: '/(auth)/welcome',
      auth: false,
      states: [
        { id: 'default', intent: 'first screen a new donor sees' },
        { id: 'locale-ru', locale: 'ru-RU', intent: 'Russian copy at the same widths' },
        { id: 'locale-uz', locale: 'uz-UZ', intent: 'Uzbek copy at the same widths' },
        { id: 'light', theme: 'light', intent: 'light appearance' },
      ],
    },
    {
      id: 'auth/login',
      title: 'Sign in',
      url: '/(auth)/login',
      auth: false,
      states: [
        { id: 'empty', intent: 'nothing entered yet' },
        { id: 'email-mode', intent: 'switched from phone to email', act: tap('Use my email address') },
        {
          id: 'validation-errors',
          intent: 'submitted empty, so every rule fires at once',
          act: sequence(tap('Sign In', { after: 900 })),
        },
        {
          id: 'server-error',
          intent: 'the API answered 500',
          routes: { '/auth/login': FAIL },
          act: sequence(type('90 123 45 67', '901234567'), type('••••••••', 'DevelopmentOnly!123'), tap('Sign In', { after: 1500 })),
        },
        {
          id: 'loading',
          intent: 'request in flight, button in its pending state',
          routes: { '/auth/login': { hang: true } },
          act: sequence(type('90 123 45 67', '901234567'), type('••••••••', 'DevelopmentOnly!123'), tap('Sign In', { after: 800 })),
        },
        { id: 'locale-ru', locale: 'ru-RU', intent: 'Russian labels and helper text' },
        { id: 'locale-uz', locale: 'uz-UZ', intent: 'Uzbek labels and helper text' },
      ],
    },
    {
      id: 'auth/register',
      title: 'Create account',
      url: '/(auth)/register',
      auth: false,
      states: [
        { id: 'empty' },
        { id: 'validation-errors', act: tap('Create Bloodchain account', { after: 900 }), intent: 'submitted empty' },
        { id: 'locale-ru', locale: 'ru-RU' },
      ],
    },
    { id: 'auth/register-details', title: 'Your details', url: '/(auth)/register-details', auth: false, states: [{ id: 'empty' }, { id: 'validation-errors', act: tap('Create your account', { after: 900 }) }, { id: 'locale-uz', locale: 'uz-UZ' }] },
    { id: 'auth/phone', title: 'Phone sign-in', url: '/(auth)/phone', auth: false, states: [{ id: 'empty' }, { id: 'validation-errors', act: tap('Send a verification code by SMS', { after: 900 }) }, { id: 'server-error', routes: { '/auth/phone/request-code': FAIL }, act: sequence(type('90 123 45 67', '901234567'), tap('Send a verification code by SMS', { after: 1200 })) }] },
    {
      id: 'auth/otp',
      title: 'One-time code',
      url: '/(auth)/otp?phone=%2B998901234567',
      auth: false,
      states: [
        { id: 'empty', intent: 'code not entered' },
        { id: 'entered', intent: 'six digits in', act: async (page) => { await page.keyboard.type('123456'); await page.waitForTimeout(500); } },
        { id: 'server-error', routes: { '/auth/phone/verify-code': FAIL }, intent: 'wrong or expired code', act: async (page) => { await page.keyboard.type('123456'); await page.waitForTimeout(1500); } },
      ],
    },
    { id: 'auth/forgot-password', title: 'Forgot password', url: '/(auth)/forgot-password', auth: false, states: [{ id: 'empty' }, { id: 'validation-errors', act: tap('Send', { after: 900 }) }, { id: 'server-error', routes: { '/auth/forgot-password': FAIL }, act: sequence(type('you@example.com', 'donor@donor.local'), tap('Send', { after: 1200 })) }] },
    { id: 'auth/reset-password', title: 'Reset password', url: '/(auth)/reset-password?token=qa-token', auth: false, states: [{ id: 'empty' }, { id: 'validation-errors', act: tap('Set new password', { after: 1000 }) }] },
    { id: 'auth/check-email', title: 'Check your email', url: '/(auth)/check-email?email=donor%40donor.local', auth: false, states: [{ id: 'default' }, { id: 'locale-ru', locale: 'ru-RU' }] },
    {
      id: 'auth/verify-email',
      title: 'Verify email',
      url: '/(auth)/verify-email?token=qa-token',
      auth: false,
      states: [
        { id: 'loading', routes: { '/auth/verify-email': { hang: true } }, intent: 'while the token is being checked' },
        { id: 'server-error', routes: { '/auth/verify-email': { status: 400, code: 'INVALID_TOKEN', message: 'This link has expired.' } }, intent: 'expired link' },
      ],
    },

    /* --------------------------------------------------- onboarding -- */
    {
      id: 'onboarding/complete-profile',
      title: 'Complete your profile',
      url: '/(onboarding)/complete-profile',
      states: [
        { id: 'step-1-blood-type', intent: 'first step as it opens' },
        { id: 'step-2-your-name', act: tap('Continue', { after: 900 }) },
        { id: 'permission-location-explainer', intent: 'the explainer the app shows BEFORE the OS is asked', act: walkTo('Set up location sharing') },
        { id: 'permission-notifications-explainer', act: walkTo('Set up notifications') },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'locale-uz', locale: 'uz-UZ' },
      ],
    },

    /* --------------------------------------------------------- tabs -- */
    {
      id: 'tabs/home',
      title: 'Home',
      url: '/(app)/home',
      states: [
        { id: 'populated', intent: 'seeded donor: verified blood type, history, next appointment' },
        { id: 'empty', intent: 'nothing scheduled, no emergencies, no campaigns', routes: { '/appointments/me/next': { body: null }, '/donor/emergencies': { body: SOS.empty }, '/campaigns': { body: { items: [], total: 0 } }, '/donations/me/statistics': { body: { totalDonations: 0, totalVolumeMl: 0, completedCount: 0, cancelledCount: 0 } } } },
        { id: 'error', intent: 'every section failed', routes: { '/donations/me/statistics': FAIL, '/appointments/me/next': FAIL, '/donor/emergencies': FAIL, '/campaigns': FAIL, '/notifications/unread-count': FAIL } },
        { id: 'offline', intent: 'the data requests never reach the server', routes: { '/donations/me': { abort: true }, '/appointments/me': { abort: true }, '/donor/emergencies': { abort: true }, '/campaigns': { abort: true } } },
        { id: 'emergency-banner', intent: 'an active emergency matching this donor', routes: { '/donor/emergencies': { body: SOS.list } } },
        { id: 'loading', routes: { '/donations/me': { hang: true }, '/appointments/me': { hang: true }, '/donor/emergencies': { hang: true }, '/campaigns': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'locale-uz', locale: 'uz-UZ' },
        { id: 'light', theme: 'light' },
        { id: 'long-content', fullPage: true, intent: 'whole page, to see it end to end' },
      ],
    },
    {
      id: 'tabs/health',
      title: 'Health',
      url: '/(app)/health',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/me/laboratory-results': { body: [] }, '/me/laboratory-appointments': { body: [] } } },
        { id: 'error', routes: { '/me/laboratory-results': FAIL, '/me/laboratory-appointments': FAIL } },
        { id: 'partial-failure', intent: 'results loaded, appointments did not', routes: { '/me/laboratory-appointments': FAIL } },
        { id: 'ai-unavailable', routes: { '/ai': FAIL } },
        { id: 'loading', routes: { '/me/laboratory': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'tabs/donate',
      title: 'Donate',
      url: '/(app)/donate',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/campaigns': { body: { items: [], total: 0 } }, '/donations/me': { body: [] } } },
        { id: 'error', routes: { '/donations/me/statistics': FAIL, '/campaigns': FAIL } },
        { id: 'loading', routes: { '/donations/me': { hang: true }, '/campaigns': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'locale-uz', locale: 'uz-UZ' },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'tabs/community',
      title: 'Community',
      url: '/(app)/community',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/community/feed': { body: { items: [], total: 0 } } } },
        { id: 'error', routes: { '/community/feed': FAIL, '/community/stats': FAIL } },
        { id: 'loading', routes: { '/community': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'tabs/calendar',
      title: 'Calendar',
      url: '/(app)/calendar',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/appointments/me': { body: [] }, '/donations/me': { body: [] } } },
        { id: 'error', routes: { '/appointments/me': FAIL } },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'locale-uz', locale: 'uz-UZ', intent: 'Uzbek weekday and month names' },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'tabs/profile',
      title: 'Profile',
      url: '/(app)/profile',
      states: [
        { id: 'populated' },
        { id: 'error', routes: { '/users/me': FAIL, '/donors/profile': FAIL } },
        { id: 'sign-out-confirmation', intent: 'the destructive action asks first', act: tap('Sign Out', { after: 900 }) },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'long-content', fullPage: true },
      ],
    },

    /* ---------------------------------------------------------- sos -- */
    {
      id: 'sos/emergency',
      title: 'Emergency SOS',
      url: '/sos',
      states: [
        { id: 'list', routes: { '/donor/emergencies': { body: SOS.list } }, intent: 'requests this donor can answer' },
        { id: 'empty', routes: { '/donor/emergencies': { body: SOS.empty } } },
        { id: 'viewing', routes: { '/donor/emergencies': { body: SOS.viewing } }, intent: 'opened, not yet answered' },
        { id: 'accepted', routes: { '/donor/emergencies': { body: SOS.accepted }, '/tracking': { body: tracking('ACCEPTED') } }, act: tap('SOS-2026-042674', { after: 900 }), intent: 'the accepted response, opened' },
        { id: 'en-route', routes: { '/donor/emergencies': { body: SOS.enRoute }, '/tracking': { body: tracking('EN_ROUTE') } }, act: tap('SOS-2026-042674', { after: 900 }), intent: 'journey started; map shows positions and says so' },
        { id: 'arrived', routes: { '/donor/emergencies': { body: SOS.arrived }, '/tracking': { body: tracking('ARRIVED') } }, act: tap('SOS-2026-042674', { after: 900 }), intent: 'the last state a donor owns' },
        { id: 'network-failure', routes: { '/donor/emergencies': { abort: true } } },
        { id: 'server-error', routes: { '/donor/emergencies': FAIL } },
        { id: 'loading', routes: { '/donor/emergencies': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU', routes: { '/donor/emergencies': { body: SOS.list } } },
        { id: 'locale-uz', locale: 'uz-UZ', routes: { '/donor/emergencies': { body: SOS.list } } },
        { id: 'light', theme: 'light', routes: { '/donor/emergencies': { body: SOS.list } } },
      ],
    },

    /* ------------------------------------------------------ booking -- */
    { id: 'booking/1-select-type', title: 'Booking — type', url: '/(booking)/select-type', states: [{ id: 'default' }, { id: 'selected', act: tap('Blood donation', { after: 500 }) }, { id: 'locale-ru', locale: 'ru-RU' }] },
    {
      id: 'booking/2-organizations',
      title: 'Booking — centre',
      url: '/(booking)/organizations?type=BLOOD_DONATION',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/organizations/discover': { body: [] } } },
        { id: 'error', routes: { '/organizations/discover': FAIL } },
        { id: 'loading', routes: { '/organizations/discover': { hang: true } }, settle: 1500 },
        { id: 'filters-open', act: tap('Show filters', { after: 800 }) },
        { id: 'permission-location-explainer', intent: 'nearby asks before the OS does', act: sequence(tap('Show filters', { after: 800 }), tap('Near me', { after: 1000 })) },
        { id: 'locale-ru', locale: 'ru-RU' },
      ],
    },
    {
      id: 'booking/3-date',
      title: 'Booking — date',
      url: `/(booking)/date?${booking}`,
      states: [
        { id: 'populated' },
        { id: 'no-open-dates', routes: { '/appointments/availability': { body: [] } }, intent: 'the month has nothing open' },
        { id: 'error', routes: { '/appointments/availability': FAIL } },
        { id: 'loading', routes: { '/appointments/availability': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'locale-uz', locale: 'uz-UZ' },
      ],
    },
    {
      id: 'booking/4-time',
      title: 'Booking — time',
      url: `/(booking)/time?${booking}&date=${ids.date ?? ''}`,
      states: [
        { id: 'populated' },
        { id: 'no-times', routes: { '/appointments/availability': { body: [] } } },
        { id: 'error', routes: { '/appointments/availability': FAIL } },
        { id: 'loading', routes: { '/appointments/availability': { hang: true } }, settle: 1500 },
      ],
    },
    {
      id: 'booking/5-review',
      title: 'Booking — review',
      url: `/(booking)/review?${booking}&date=${ids.date ?? ''}&slotId=${ids.slotId ?? ''}`,
      states: [
        { id: 'populated' },
        { id: 'slot-taken', intent: 'someone else took it while this donor decided', routes: { 'POST /appointments': { status: 409, code: 'SLOT_UNAVAILABLE', message: 'That time has just been taken.' } }, act: tap('Confirm appointment', { after: 1500 }) },
        { id: 'server-error', routes: { 'POST /appointments': FAIL }, act: tap('Confirm appointment', { after: 1500 }) },
        { id: 'submitting', routes: { 'POST /appointments': { hang: true } }, act: tap('Confirm appointment', { after: 900 }) },
      ],
    },
    {
      id: 'booking/6-confirmation',
      title: 'Booking — confirmed',
      url: `/(booking)/confirmation?appointmentId=${ids.appointmentId}`,
      states: [
        { id: 'populated' },
        { id: 'loading', routes: { '/appointments/': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
      ],
    },

    /* -------------------------------------------------- lab booking -- */
    { id: 'lab-booking/1-test-type', title: 'Lab — test', url: '/(lab-booking)/test-type', states: [{ id: 'populated' }, { id: 'empty', routes: { '/test-types': { body: [] } } }, { id: 'error', routes: { '/test-types': FAIL } }, { id: 'loading', routes: { '/test-types': { hang: true } }, settle: 1500 }] },
    { id: 'lab-booking/2-laboratory', title: 'Lab — laboratory', url: `/(lab-booking)/laboratory?testTypeId=${ids.testTypeId}`, states: [{ id: 'populated' }, { id: 'empty', routes: { '/laboratories': { body: [] } } }, { id: 'error', routes: { '/laboratories': FAIL } }] },
    { id: 'lab-booking/3-date', title: 'Lab — date', url: `/(lab-booking)/date?${labBooking}`, states: [{ id: 'populated' }, { id: 'no-open-dates', routes: { '/available-dates': { body: [] } } }, { id: 'error', routes: { '/available-dates': FAIL } }, { id: 'loading', routes: { '/available-dates': { hang: true } }, settle: 1500 }, { id: 'locale-uz', locale: 'uz-UZ' }] },
    { id: 'lab-booking/4-slot', title: 'Lab — slot', url: `/(lab-booking)/slot?${labBooking}&date=${ids.lab?.date ?? ''}`, states: [{ id: 'populated' }, { id: 'no-times', routes: { '/slots': { body: [] } } }, { id: 'error', routes: { '/slots': FAIL } }] },
    { id: 'lab-booking/5-review', title: 'Lab — review', url: `/(lab-booking)/review?${labBooking}&date=${ids.lab?.date ?? ''}&slotId=${ids.lab?.slotId ?? ''}`, states: [{ id: 'populated' }, { id: 'slot-taken', routes: { 'POST /laboratory-appointments': { status: 409, code: 'SLOT_UNAVAILABLE', message: 'That time has just been taken.' } }, act: tap('Book this test', { after: 1500 }) }, { id: 'server-error', routes: { 'POST /laboratory-appointments': FAIL }, act: tap('Book this test', { after: 1500 }) }] },
    { id: 'lab-booking/6-confirmation', title: 'Lab — confirmed', url: `/(lab-booking)/confirmation?appointmentId=${ids.labAppointmentId ?? ''}`, states: [{ id: 'populated' }, { id: 'loading', routes: { '/me/laboratory-appointments/': { hang: true } }, settle: 1500 }] },

    /* ------------------------------------------------- health & AI -- */
    {
      id: 'health/laboratory',
      title: 'Blood tests',
      url: '/(app)/laboratory',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/me/laboratory-appointments': { body: [] }, '/me/laboratory-results': { body: [] } } },
        { id: 'error', routes: { '/me/laboratory-appointments': FAIL, '/me/laboratory-results': FAIL } },
        { id: 'partial-failure', intent: 'one list failed; the other must not read as "you have none"', routes: { '/me/laboratory-results': FAIL } },
        { id: 'loading', routes: { '/me/laboratory': { hang: true } }, settle: 1500 },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'health/trends',
      title: 'Health trends',
      url: '/(app)/health-trends',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/trend': { body: { parameterCode: 'HGB', points: [] } }, '/me/laboratory-results': { body: [] } } },
        { id: 'error', routes: { '/me/laboratory-results': FAIL } },
        { id: 'loading', routes: { '/me/laboratory-results': { hang: true }, '/trend': { hang: true } }, settle: 1500 },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'health/insights',
      title: 'AI insights',
      url: '/(app)/insights',
      states: [
        { id: 'populated' },
        { id: 'ai-disabled', routes: { '/ai-health': { status: 403, code: 'AI_DISABLED', message: 'AI insights are switched off for this account.' } } },
        { id: 'error', routes: { '/ai-health': FAIL } },
        { id: 'loading', routes: { '/ai-health': { hang: true } }, settle: 1500 },
        { id: 'long-content', fullPage: true },
      ],
    },

    /* --------------------------------------------- history & detail -- */
    {
      id: 'history/donations',
      title: 'Donation history',
      url: '/(app)/donations',
      states: [
        { id: 'populated' },
        {
          id: 'empty',
          // The statistics route shares the prefix and is matched first, so
          // the tile shows zeros rather than a list where a figure should be.
          routes: {
            '/donations/me/statistics': { body: { totalDonations: 0, totalVolumeMl: 0, completedCount: 0, cancelledCount: 0, abortedCount: 0 } },
            '/donations/me': { body: [] },
          },
        },
        { id: 'filtered-empty', intent: 'a filter with no matches is not the same as having none', act: tap('Cancelled', { after: 900 }) },
        { id: 'error', routes: { '/donations/me': FAIL } },
        { id: 'loading', routes: { '/donations/me': { hang: true } }, settle: 1500 },
        { id: 'long-content', fullPage: true },
      ],
    },
    { id: 'history/donation-detail', title: 'Donation detail', url: `/(app)/donations/${ids.donationId}`, states: [{ id: 'populated' }, { id: 'error', routes: { '/donations/': FAIL } }, { id: 'loading', routes: { '/donations/': { hang: true } }, settle: 1500 }, { id: 'locale-ru', locale: 'ru-RU' }, { id: 'long-content', fullPage: true }] },
    { id: 'history/appointment-detail', title: 'Appointment detail', url: `/(app)/appointment/${ids.appointmentId}`, states: [{ id: 'populated' }, { id: 'cancel-confirmation', intent: 'cancelling asks first', act: tap('Cancel', { after: 1000 }) }, { id: 'error', routes: { '/appointments/': FAIL } }, { id: 'long-content', fullPage: true }] },

    /* ------------------------------------- community and recognition -- */
    { id: 'community/campaigns', title: 'Campaigns', url: '/(app)/campaigns', states: [{ id: 'populated' }, { id: 'empty', routes: { '/campaigns': { body: { items: [], total: 0 } } } }, { id: 'error', routes: { '/campaigns': FAIL } }, { id: 'long-content', fullPage: true }] },
    { id: 'community/challenges', title: 'Challenges', url: '/(app)/challenges', states: [{ id: 'populated' }, { id: 'empty', routes: { '/challenges': { body: { items: [], total: 0 } } } }, { id: 'error', routes: { '/challenges': FAIL } }, { id: 'long-content', fullPage: true }] },
    { id: 'community/education', title: 'Education', url: '/(app)/education', states: [{ id: 'populated' }, { id: 'empty', routes: { '/education/my/stats': { body: { totalStarted: 0, totalCompleted: 0, totalXpEarned: 0 } }, '/education': { body: { items: [], total: 0 } } } }, { id: 'error', routes: { '/education': FAIL } }, { id: 'locale-uz', locale: 'uz-UZ' }, { id: 'long-content', fullPage: true }] },
    {
      id: 'community/education-article',
      title: 'Education — the article',
      url: `/(app)/education/${ids.educationId ?? ''}`,
      states: [
        { id: 'populated', intent: 'the body the module has always carried and never showed' },
        { id: 'error', routes: { '/education/': FAIL } },
        { id: 'loading', routes: { '/education/': { hang: true } }, settle: 1500 },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'long-content', fullPage: true },
      ],
    },
    { id: 'community/gamification', title: 'Recognition', url: '/(app)/gamification', states: [{ id: 'populated' }, { id: 'error', routes: { '/me/gamification': FAIL } }, { id: 'loading', routes: { '/me/gamification': { hang: true } }, settle: 1500 }, { id: 'long-content', fullPage: true }] },
    { id: 'community/badges', title: 'Badges', url: '/(app)/gamification/badges', states: [{ id: 'populated' }, { id: 'empty', routes: { '/badges': { body: [] } } }, { id: 'error', routes: { '/badges': FAIL } }, { id: 'long-content', fullPage: true }] },
    { id: 'community/achievements', title: 'Achievements', url: '/(app)/gamification/achievements', states: [{ id: 'populated' }, { id: 'empty', routes: { '/achievements': { body: [] } } }, { id: 'error', routes: { '/achievements': FAIL } }, { id: 'long-content', fullPage: true }] },
    { id: 'community/leaderboard', title: 'Leaderboard', url: '/(app)/gamification/leaderboard', states: [{ id: 'populated' }, { id: 'empty', routes: { '/leaderboard': { body: { items: [], total: 0 } } } }, { id: 'error', routes: { '/leaderboard': FAIL } }, { id: 'long-content', fullPage: true }] },

    /* ---------------------------------------------- profile & account -- */
    {
      id: 'account/privacy',
      title: 'Privacy',
      url: '/(app)/privacy',
      states: [
        { id: 'default', intent: 'what the backend can actually do, and what it cannot' },
        { id: 'delete-account', intent: 'the deletion route as it stands today', act: tap('Delete account', { after: 900 }) },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'account/security',
      title: 'Security',
      url: '/(app)/security',
      states: [
        { id: 'default' },
        { id: 'change-password', act: tap('Change password', { after: 900 }) },
        { id: 'validation-errors', act: sequence(tap('Change password', { after: 900 }), tap('Change password', { after: 1100 })) },
        { id: 'sessions-error', routes: { '/auth/sessions': FAIL } },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'account/notifications',
      title: 'Notifications',
      url: '/(app)/notifications',
      states: [
        { id: 'populated' },
        { id: 'empty', routes: { '/notifications': { body: { items: [], total: 0 } } } },
        { id: 'error', routes: { '/notifications': FAIL } },
        { id: 'loading', routes: { '/notifications': { hang: true } }, settle: 1500 },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'account/notification-settings',
      title: 'Notification settings',
      url: '/(app)/notification-settings',
      states: [
        { id: 'default' },
        { id: 'permission-explainer', intent: 'explained before the OS is asked', act: tap('Set up notifications', { after: 900 }) },
        { id: 'error', routes: { '/notifications/preferences': FAIL } },
        { id: 'locale-ru', locale: 'ru-RU' },
        { id: 'long-content', fullPage: true },
      ],
    },
    {
      id: 'account/profile-edit',
      title: 'Edit profile',
      url: '/(app)/profile/edit',
      states: [
        { id: 'populated' },
        { id: 'validation-errors', act: sequence(type('90 123 45 67', '1'), tap('Save', { after: 1000 })) },
        { id: 'server-error', routes: { '/users/me': FAIL }, act: tap('Save', { after: 1200 }) },
        { id: 'long-content', fullPage: true },
      ],
    },
    { id: 'account/profile-donor', title: 'Donor profile', url: '/(app)/profile/donor', states: [{ id: 'populated' }, { id: 'error', routes: { '/donors/profile': FAIL } }, { id: 'locale-ru', locale: 'ru-RU' }, { id: 'long-content', fullPage: true }] },

    /* ------------------------------------------------------ courier -- */
    {
      id: 'courier/active',
      title: 'Courier — active delivery',
      url: '/(courier)/active',
      auth: 'courier',
      states: [
        { id: 'populated', routes: { '/courier/shipments/active': { body: COURIER.active } } },
        { id: 'empty', routes: { '/courier/shipments/active': { body: null } } },
        { id: 'error', routes: { '/courier/shipments/active': FAIL } },
        { id: 'loading', routes: { '/courier/shipments/active': { hang: true } }, settle: 1500 },
        { id: 'permission-location-explainer', routes: { '/courier/shipments/active': { body: COURIER.active } }, act: tap('Share my location', { after: 900 }) },
        { id: 'long-content', fullPage: true, routes: { '/courier/shipments/active': { body: COURIER.active } } },
      ],
    },
    { id: 'courier/history', title: 'Courier — history', url: '/(courier)/history', auth: 'courier', states: [{ id: 'populated' }, { id: 'empty', routes: { '/courier/shipments': { body: [] } } }, { id: 'error', routes: { '/courier/shipments': FAIL } }, { id: 'long-content', fullPage: true }] },
    { id: 'courier/profile', title: 'Courier — profile', url: '/(courier)/profile', auth: 'courier', states: [{ id: 'populated' }, { id: 'error', routes: { '/courier/profile': FAIL } }, { id: 'sign-out-confirmation', act: tap('Log out', { after: 900 }) }, { id: 'long-content', fullPage: true }] },
  ];
}
