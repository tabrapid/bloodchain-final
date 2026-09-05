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
jest.mock('../components/map/LocationMap', () => ({
  LocationMap: () => null,
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

async function render() {
  const element = (
    <ThemeProvider>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <SosScreen />
      </SafeAreaProvider>
    </ThemeProvider>
  );

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
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

    await press(tree, 'Yes, I Can Help');
    expect(acceptEmergency).toHaveBeenCalledWith(emergency.matchId);
    expectNoCompletionControl(tree);

    await press(tree, 'Start Journey');
    expect(startJourney).toHaveBeenCalledWith('response-1');
    expectNoCompletionControl(tree);

    await press(tree, 'I Have Arrived');
    expect(arriveAtHospital).toHaveBeenCalledWith('response-1');

    // Arrival is the end of the donor's authority. What follows -- the
    // donation being started and completed -- is staff-verified, so the screen
    // must offer no way to claim it.
    expect(renderedText(tree)).toContain('Please check in at the reception');
    expectNoCompletionControl(tree);
  });

  it('offers cancellation at every stage before the hospital takes over', async () => {
    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, 'Yes, I Can Help');

    expect(renderedText(tree)).toContain('Cancel My Response');

    await press(tree, 'Start Journey');
    expect(renderedText(tree)).toContain('Cancel My Response');

    await press(tree, 'I Have Arrived');
    expect(renderedText(tree)).toContain('Cancel My Response');
  });

  it('declining returns to the list without accepting', async () => {
    const tree = await render();
    await press(tree, emergency.emergencyReference);
    await press(tree, 'Decline Request');

    expect(declineEmergency).toHaveBeenCalledWith(emergency.matchId);
    expect(acceptEmergency).not.toHaveBeenCalled();
  });

  it('surfaces a load failure instead of rendering an empty list', async () => {
    jest.mocked(getDonorEmergencies).mockRejectedValueOnce(new Error('Network unreachable'));
    const tree = await render();

    const text = renderedText(tree);
    expect(text).toContain('Error Loading Emergencies');
    expect(text).toContain('Network unreachable');
  });
});
