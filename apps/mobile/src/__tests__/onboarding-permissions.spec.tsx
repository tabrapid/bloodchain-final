import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createLocalization } from '@bloodchain/i18n';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
  deleteItemAsync: async () => undefined,
}));

const mockRequestLocation = jest.fn(async () => ({ status: 'granted', canAskAgain: true }));
const mockGetPosition = jest.fn(async () => ({ coords: { latitude: 41.3, longitude: 69.2 } }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestLocation(...(args as [])),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetPosition(...(args as [])),
  Accuracy: { Balanced: 3 },
}));

const mockRequestNotifications = jest.fn(async () => ({ status: 'granted', canAskAgain: true }));
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestNotifications(...(args as [])),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

const mockRegisterPush = jest.fn(async () => undefined);
jest.mock('../notifications/push', () => ({
  registerForPushNotificationsAsync: () => mockRegisterPush(),
}));

// What this build can actually deliver. Default: a configured build, so every
// existing case below is unaffected.
const pushConfig: { configured: boolean; expected: boolean; projectId?: string; reason?: string } = {
  configured: true,
  expected: false,
  projectId: 'project-from-the-build',
};
jest.mock('../notifications/push-config', () => ({
  get pushConfig() {
    return pushConfig;
  },
}));

jest.mock('../hooks/useDonors', () => ({
  useUpdateDonorProfile: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../hooks/useUsers', () => ({
  useUpdateUserProfile: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../hooks/useNotifications', () => ({
  useUpdateNotificationPreferences: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

import CompleteProfile from '../../app/(onboarding)/complete-profile';

const { t } = createLocalization('en');

function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <LocaleProvider>
            <SafeAreaProvider
              initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 47, left: 0, right: 0, bottom: 34 },
              }}
            >
              <CompleteProfile />
            </SafeAreaProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  return tree;
}

function renderedText(tree: renderer.ReactTestRenderer): string {
  return tree.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join(' | ');
}

/** The first pressable announcing this label, composite or host. */
function press(tree: renderer.ReactTestRenderer, label: string) {
  const node = tree.root.findAll(
    (candidate) =>
      candidate.props?.accessibilityLabel === label && typeof candidate.props?.onPress === 'function',
  )[0];
  if (!node) throw new Error(`No pressable labelled "${label}". On screen: ${renderedText(tree)}`);
  act(() => {
    (node.props.onPress as () => void)();
  });
}

/** Advance to a step by pressing Continue. */
function advance(tree: renderer.ReactTestRenderer, times: number) {
  for (let i = 0; i < times; i++) {
    press(tree, t('onboarding.continue'));
  }
}

beforeEach(() => {
  pushConfig.configured = true;
  pushConfig.expected = false;
  mockRequestLocation.mockClear().mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockGetPosition.mockClear();
  mockRequestNotifications.mockClear().mockResolvedValue({ status: 'granted', canAskAgain: true });
  mockRegisterPush.mockClear();
});

/**
 * S11 B3: nothing is asked of the operating system before the donor has been
 * told what it is for.
 *
 * V1 called `requestForegroundPermissionsAsync()` the instant a toggle marked
 * "OFF" was tapped, and explained itself afterwards in an Alert that only
 * appeared on refusal. On iOS the prompt never comes back, so "afterwards" is
 * too late by construction.
 */
describe('location is explained before it is requested', () => {
  it('asks the operating system nothing until the explainer is allowed', async () => {
    const tree = render();
    advance(tree, 3);

    press(tree, t('onboarding.explainLocation'));
    expect(mockRequestLocation).not.toHaveBeenCalled();

    // The explanation is on screen, with what it is used for and what it is not.
    const text = renderedText(tree);
    expect(text).toContain(t('onboarding.locationExplainerTitle'));
    expect(text).toContain(t('onboarding.locationAssuranceNotTracked'));

    await act(async () => {
      press(tree, t('onboarding.locationAllow'));
    });
    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('costs nothing to decline, and does not ask on the donor’s behalf', () => {
    const tree = render();
    advance(tree, 3);

    press(tree, t('onboarding.explainLocation'));
    press(tree, t('sos.locationNotNow'));

    expect(mockRequestLocation).not.toHaveBeenCalled();
    // And the step is still usable: declining is not a dead end.
    expect(renderedText(tree)).toContain(t('onboarding.city'));
    act(() => tree.unmount());
  });

  it('says so honestly when the phone will not ask again', async () => {
    mockRequestLocation.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const tree = render();
    advance(tree, 3);

    press(tree, t('onboarding.explainLocation'));
    await act(async () => {
      press(tree, t('onboarding.locationAllow'));
    });

    const text = renderedText(tree);
    expect(text).toContain(t('onboarding.locationBlockedTitle'));
    expect(text).toContain(t('sos.locationDeniedOpenSettings'));
    act(() => tree.unmount());
  });
});

describe('notifications are explained before they are requested', () => {
  it('asks the operating system nothing on mount, nor on reaching the step', () => {
    const tree = render();
    advance(tree, 4);

    expect(mockRequestNotifications).not.toHaveBeenCalled();
    expect(renderedText(tree)).toContain(t('onboarding.notificationsPermissionNote'));
    act(() => tree.unmount());
  });

  it('registers the device only after the donor has allowed it', async () => {
    const tree = render();
    advance(tree, 4);

    press(tree, t('onboarding.explainNotifications'));
    expect(mockRequestNotifications).not.toHaveBeenCalled();
    expect(renderedText(tree)).toContain(t('onboarding.notificationsAssuranceNoMarketing'));

    await act(async () => {
      press(tree, t('onboarding.notificationsAllow'));
    });

    expect(mockRequestNotifications).toHaveBeenCalledTimes(1);
    expect(mockRegisterPush).toHaveBeenCalledTimes(1);
    expect(renderedText(tree)).toContain(t('onboarding.notificationsAllowed'));
    act(() => tree.unmount());
  });

  /**
   * The phone saying yes is not the same as the app being able to deliver.
   *
   * There is no Expo project for this product yet, so on a preview or
   * production build every one of the categories above -- emergency requests
   * included -- is unreachable. Showing "Notifications are on" here would be
   * the same untruth the settings screen used to tell, on the screen that
   * actually does the asking.
   */
  it('does not claim notifications are on when this build cannot deliver any', async () => {
    pushConfig.configured = false;
    pushConfig.expected = false;
    const tree = render();
    advance(tree, 4);

    press(tree, t('onboarding.explainNotifications'));
    await act(async () => {
      press(tree, t('onboarding.notificationsAllow'));
    });

    const text = renderedText(tree);
    expect(text).not.toContain(t('onboarding.notificationsAllowed'));
    expect(text).toContain(t('notificationSettings.unavailableTitle'));
    act(() => tree.unmount());
  });

  it('keeps the category choices usable when the donor says no', async () => {
    mockRequestNotifications.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const tree = render();
    advance(tree, 4);

    press(tree, t('onboarding.explainNotifications'));
    await act(async () => {
      press(tree, t('onboarding.notificationsAllow'));
    });

    const text = renderedText(tree);
    expect(text).toContain(t('onboarding.notificationsBlockedTitle'));
    expect(mockRegisterPush).not.toHaveBeenCalled();
    // The preferences themselves are still there to be saved.
    expect(text).toContain(t('onboarding.notifyEmergencies'));
    act(() => tree.unmount());
  });
});
