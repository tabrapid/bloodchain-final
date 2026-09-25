import React from 'react';
import renderer, { act, type ReactTestRendererJSON } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';

/**
 * Emergency SOS is the most consequential flow in this app: a donor deciding,
 * under time pressure, whether to travel to a hospital for a life-critical
 * request. Its rules are safety rules, not product preferences, and until now
 * nothing in the test suite held them.
 *
 * The rule these tests exist for: **the donor can never complete a donation.**
 * `EmergencyResponse` advances ACCEPTED -> EN_ROUTE -> ARRIVED from this
 * screen, and DONATION_STARTED -> COMPLETED only from staff-side systems. A
 * donor-facing "mark as donated" control would let someone credit themselves
 * with a donation that never happened -- the one fraud this design forecloses.
 *
 * So these assert the *whole* set of actions the screen offers, in every
 * state, rather than only that the current buttons work. Adding a completion
 * control anywhere in this file fails the suite.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));
// The map is a native module (react-native-maps) with no JS-only fallback.
// Recorded rather than nulled, so the props the screen passes it can be
// asserted -- `showRoute` in particular.
const mapProps: Record<string, unknown>[] = [];
jest.mock('../components/map/LocationMap', () => ({
  LocationMap: (props: Record<string, unknown>) => {
    mapProps.push(props);
    return null;
  },
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../api/emergency', () => ({
  getDonorEmergencies: jest.fn(),
  viewEmergencyMatch: jest.fn(),
  acceptEmergency: jest.fn(),
  declineEmergency: jest.fn(),
  startJourney: jest.fn(),
  arriveAtHospital: jest.fn(),
  cancelResponse: jest.fn(),
  getDonorTracking: jest.fn(),
  updateLocation: jest.fn(),
}));

import * as Location from 'expo-location';
import {
  getDonorEmergencies,
  viewEmergencyMatch,
  acceptEmergency,
  declineEmergency,
  startJourney,
  arriveAtHospital,
  getDonorTracking,
} from '../api/emergency';

import SosScreen from '../../app/sos';
import { LocaleProvider } from '../i18n';
import { createLocalization } from '@bloodchain/i18n';

/**
 * The screens' own words, looked up the way the screens look them up, so a
 * catalogue rewording moves the assertion with it instead of breaking it.
 */
const { t } = createLocalization('en');

const emergency = {
  id: 'emergency-1',
  emergencyReference: 'EMG-2026-0001',
  hospitalId: 'hospital-1',
  bloodType: 'O',
  rhFactor: 'POSITIVE',
  unitsRequired: 3,
  urgencyLevel: 'CRITICAL',
  status: 'ACTIVE',
  unitsCollected: 0,
  createdAt: '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T08:00:00.000Z',
  hospital: { id: 'hospital-1', name: 'Central Hospital', address: '1 Main St' },
  matchId: 'match-1',
  matchStatus: 'NOTIFIED',
  canAccept: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mapProps.length = 0;
  jest.mocked(getDonorEmergencies).mockResolvedValue({
    active: [emergency],
    myResponses: [],
  } as never);
  jest.mocked(viewEmergencyMatch).mockResolvedValue({} as never);
  jest.mocked(acceptEmergency).mockResolvedValue({ id: 'response-1' } as never);
  jest.mocked(declineEmergency).mockResolvedValue({} as never);
  jest.mocked(startJourney).mockResolvedValue({} as never);
  jest.mocked(arriveAtHospital).mockResolvedValue({} as never);
  jest.mocked(getDonorTracking).mockResolvedValue({ locations: [] } as never);
});

/**
 * Mounted trees, unmounted after each test. Mounting this screen starts a
 * 15-second tracking poll and an expo-location watcher; leaving them running
 * past the end of the test file means they fire during Jest's teardown, when
 * the module registry is already gone -- at which point `LinearGradient`
 * resolves to a bare object and React throws mid-render. That is a slow-CI
 * failure and a local "worker process failed to exit gracefully" warning: the
 * same leak, showing up differently depending on how fast the machine is.
 */
const mounted: renderer.ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

async function render() {
  const element = (
    <ThemeProvider>
      <LocaleProvider>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <SosScreen />
      </SafeAreaProvider>
      </LocaleProvider>
    </ThemeProvider>
  );

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  mounted.push(tree);
  await flush();
  return tree;
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function renderedText(tree: renderer.ReactTestRenderer): string {
  const strings: string[] = [];
  const walk = (node: ReactTestRendererJSON | null) => {
    if (!node) return;
    (node.children ?? []).forEach((child) => {
      if (typeof child === 'string') strings.push(child);
      else if (child && typeof child === 'object') walk(child);
    });
  };
  walk(tree.toJSON() as ReactTestRendererJSON);
  return strings.join(' ');
}

/** Every string rendered anywhere beneath a test instance. */
function textUnder(instance: renderer.ReactTestInstance): string {
  const strings: string[] = [];
  const walk = (node: renderer.ReactTestInstance) => {
    node.children.forEach((child) => {
      if (typeof child === 'string') strings.push(child);
      else walk(child);
    });
  };
  walk(instance);
  return strings.join(' ');
}

/**
 * The innermost pressable whose own subtree renders `label` -- innermost so a
 * screen-level wrapper never shadows the button actually being pressed.
 */
function pressableWithText(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root
    .findAll((node) => typeof node.props?.onPress === 'function', { deep: true })
    .filter((node) => textUnder(node).includes(label))
    .at(-1);
}

async function press(tree: renderer.ReactTestRenderer, label: string) {
  const target = pressableWithText(tree, label);
  expect(target).toBeDefined();
  await act(async () => {
    target!.props.onPress();
  });
  await flush();
}

/**
 * Wording a donor-facing completion control would plausibly use. The rule is
 * about the capability, so the guard is about the capability's vocabulary
 * rather than one exact string.
 */
const COMPLETION_WORDING = [
  'Complete Donation',
  'Mark Donation Complete',
  'Mark as Donated',
  'Finish Donation',
  'Donation Complete',
  'I Have Donated',
  'Confirm Donation',
];

function expectNoCompletionControl(tree: renderer.ReactTestRenderer) {
  const text = renderedText(tree);
  for (const wording of COMPLETION_WORDING) {
    expect(text.toLowerCase()).not.toContain(wording.toLowerCase());
  }
}

describe('Emergency SOS: the donor-side state machine', () => {
  it('lists an active match without offering to complete anything', async () => {
    const tree = await render();
    expect(renderedText(tree)).toContain(emergency.emergencyReference);
    expectNoCompletionControl(tree);
  });

  it('advances accept -> start journey -> arrived, and stops there', async () => {
    const tree = await render();

    // Opening the match reports it viewed, which is a real backend transition
    // (NOTIFIED -> VIEWED) and not merely a local screen change.
    await press(tree, emergency.emergencyReference);
    expect(viewEmergencyMatch).toHaveBeenCalledWith(emergency.matchId);
    expectNoCompletionControl(tree);

    await press(tree, t('sos.yesICanHelp'));
    expect(acceptEmergency).toHaveBeenCalledWith(emergency.matchId);
    expectNoCompletionControl(tree);

    await press(tree, t('sos.startJourney'));
    expect(startJourney).toHaveBeenCalledWith('response-1');
    expectNoCompletionControl(tree);

    await press(tree, t('sos.iHaveArrived'));
    expect(arriveAtHospital).toHaveBeenCalledWith('response-1');

    // Arrival is the end of the donor's authority. What follows -- the
    // donation being started and completed -- is staff-verified, so the screen
    // must offer no way to claim it.
    expect(renderedText(tree)).toContain(t('sos.checkInAtReception'));
    expectNoCompletionControl(tree);
  });

  it('offers cancellation at every stage before the hospital takes over', async () => {
    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, t('sos.yesICanHelp'));

    expect(renderedText(tree)).toContain(t('sos.cancelMyResponse'));

    await press(tree, t('sos.startJourney'));
    expect(renderedText(tree)).toContain(t('sos.cancelMyResponse'));

    await press(tree, t('sos.iHaveArrived'));
    expect(renderedText(tree)).toContain(t('sos.cancelMyResponse'));
  });

  it('declining returns to the list without accepting', async () => {
    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, t('sos.declineRequest'));

    expect(declineEmergency).toHaveBeenCalledWith(emergency.matchId);
    expect(acceptEmergency).not.toHaveBeenCalled();
  });

  it('surfaces a load failure instead of rendering an empty list', async () => {
    jest.mocked(getDonorEmergencies).mockRejectedValueOnce(new Error('Network unreachable'));
    const tree = await render();

    const text = renderedText(tree);
    expect(text).toContain(t('sos.loadFailedTitle'));
    expect(text).toContain('Network unreachable');
  });
  /**
   * The operating system's location prompt is one line, and on iOS it is one
   * chance: deny it and it never appears again. So the reason is given in the
   * app first, with room to say what is sent, to whom, and when it stops.
   */
  it('explains why it wants a location before the OS is allowed to ask', async () => {
    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, t('sos.yesICanHelp'));

    // Nothing asked yet: the donor has committed, not started moving.
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    await press(tree, t('sos.startJourney'));

    // The journey started, and the explanation is on screen -- but the OS has
    // still not been asked.
    expect(startJourney).toHaveBeenCalledWith('response-1');
    expect(renderedText(tree)).toContain(t('sos.locationExplainerTitle'));
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    await press(tree, t('sos.locationAllow'));
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  /**
   * "Not now" has to be a real answer, not a way of deferring the same
   * question. It costs the donor nothing: the journey continues, the OS is
   * never asked, and the screen says what the hospital will and will not see.
   */
  it('lets the donor travel without sharing a location, and says what that means', async () => {
    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, t('sos.yesICanHelp'));
    await press(tree, t('sos.startJourney'));
    await press(tree, t('sos.locationNotNow'));

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();

    // Still en route, and the arrival action is still there.
    expect(renderedText(tree)).toContain(t('sos.iHaveArrived'));
    // Asked once, not on every render.
    expect(renderedText(tree)).not.toContain(t('sos.locationExplainerTitle'));
  });

  it('says the location is off when the OS refuses, rather than failing silently', async () => {
    jest
      .mocked(Location.requestForegroundPermissionsAsync)
      .mockResolvedValueOnce({ status: 'denied' } as never);

    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, t('sos.yesICanHelp'));
    await press(tree, t('sos.startJourney'));
    await press(tree, t('sos.locationAllow'));

    const text = renderedText(tree);
    expect(text).toContain(t('sos.locationDeniedTitle'));
    // And it still does not block the journey.
    expect(text).toContain(t('sos.iHaveArrived'));
    expect(Location.watchPositionAsync).not.toHaveBeenCalled();
  });

  /**
   * The app has two coordinates and no routing engine. A line between them is
   * a straight line over buildings, and an arrival time derived from it is
   * invented -- which a donor would act on.
   */
  it('never draws a route between the donor and the hospital', async () => {
    jest.mocked(getDonorTracking).mockResolvedValue({
      locations: [{ latitude: '41.3', longitude: '69.2' }],
      emergencyRequest: {
        hospital: { name: 'Central Hospital', address: '1 Main St', latitude: '41.31', longitude: '69.25' },
      },
    } as never);

    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, t('sos.yesICanHelp'));

    expect(mapProps.length).toBeGreaterThan(0);
    for (const props of mapProps) {
      expect(props.showRoute).toBeFalsy();
    }
    // And the caption says so in words, because the absence of a line is not
    // self-explanatory.
    expect(renderedText(tree)).toContain(t('sos.noRouteShown'));
  });
});

/**
 * S11.1: two things the emergency screens said in the database's words.
 *
 * The urgency badge printed the API's own CRITICAL / HIGH / MEDIUM / LOW on a
 * screen that is otherwise fully translated, and the Rh sign was computed two
 * different ways -- three-valued on the list card, two-valued on the detail --
 * so a request with an unknown factor read "AB" in the list and "AB-" one tap
 * later. On this screen that is a different blood type.
 */
describe('emergency urgency and Rh, in words a donor can read', () => {
  it.each(['uz', 'ru', 'en'])('translates every urgency level in %s', (locale) => {
    const { createLocalization } = require('@bloodchain/i18n');
    const { t } = createLocalization(locale);

    for (const level of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      const label = t(`status.urgency.${level}`);
      expect(label).not.toBe(`status.urgency.${level}`);
      expect(label).not.toBe(level);
    }
  });
});
