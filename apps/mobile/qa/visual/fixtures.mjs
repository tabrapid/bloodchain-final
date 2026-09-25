/**
 * Responses the harness serves in place of the API, for the states a seeded
 * database cannot be asked to produce on demand.
 *
 * Three kinds, and the difference matters:
 *
 *   `empty`    - the real endpoint, answering truthfully with nothing.
 *   `fail`     - the real endpoint, answering 500 or refusing the connection.
 *   `fixture`  - a body shaped by the app's own TypeScript interface for that
 *                endpoint (src/api/*.ts), used only where a state cannot be
 *                reached any other way: the emergency journey, which needs a
 *                hospital to raise a request and a matcher to match it.
 *
 * None of this is in the app. It is served by the browser-side router in
 * capture.mjs, so the screen under photograph is the real screen and the only
 * thing substituted is what the network said.
 */

const iso = (offsetMinutes = 0) => new Date(Date.now() + offsetMinutes * 60_000).toISOString();

const HOSPITAL = {
  id: 'qa-hospital',
  name: 'Jizzakh City Hospital',
  address: "Sharof Rashidov ko'chasi 12, Jizzakh",
};

/** An EmergencyRequest as src/api/emergency.ts declares it. */
function emergency(overrides = {}) {
  return {
    id: 'qa-emergency-1',
    emergencyReference: 'SOS-2026-042674',
    hospitalId: HOSPITAL.id,
    bloodType: 'O',
    rhFactor: 'POSITIVE',
    unitsRequired: 3,
    urgencyLevel: 'CRITICAL',
    status: 'ACTIVE',
    patientReference: 'PT-4471',
    description: 'Post-partum haemorrhage. Theatre 2.',
    requiredBefore: iso(95),
    donationLocation: 'Emergency entrance, ground floor',
    latitude: '40.1158',
    longitude: '67.8422',
    unitsCollected: 1,
    createdAt: iso(-40),
    updatedAt: iso(-4),
    hospital: HOSPITAL,
    matchId: 'qa-match-1',
    matchStatus: 'MATCHED',
    canAccept: true,
    ...overrides,
  };
}

/**
 * The donor's emergency journey, one entry per state the screen can be in.
 *
 * ACCEPTED -> EN_ROUTE -> ARRIVED is the whole of it on this side; a donor
 * never completes their own response, and there is deliberately no fixture
 * here that would let the screen pretend otherwise.
 */
export const SOS = {
  list: { active: [emergency(), emergency({ id: 'qa-emergency-2', emergencyReference: 'SOS-2026-502366', bloodType: 'A', urgencyLevel: 'HIGH', unitsRequired: 2, unitsCollected: 0, matchId: 'qa-match-2', matchStatus: 'NOTIFIED', requiredBefore: iso(220) })], myResponses: [] },
  empty: { active: [], myResponses: [] },
  viewing: { active: [emergency({ matchStatus: 'VIEWED' })], myResponses: [] },
  accepted: {
    active: [],
    myResponses: [emergency({ matchStatus: 'ACCEPTED', canAccept: false, responseId: 'qa-response-1', responseStatus: 'ACCEPTED' })],
  },
  enRoute: {
    active: [],
    myResponses: [emergency({ matchStatus: 'ACCEPTED', canAccept: false, responseId: 'qa-response-1', responseStatus: 'EN_ROUTE' })],
  },
  arrived: {
    active: [],
    myResponses: [emergency({ matchStatus: 'ACCEPTED', canAccept: false, responseId: 'qa-response-1', responseStatus: 'ARRIVED' })],
  },
};

/** The tracking payload the en-route and arrived screens poll for. */
export function tracking(status) {
  return {
    id: 'qa-response-1',
    emergencyRequestId: 'qa-emergency-1',
    donorId: 'qa-donor',
    status,
    acceptedAt: iso(-12),
    enRouteAt: status === 'ACCEPTED' ? undefined : iso(-8),
    arrivedAt: status === 'ARRIVED' ? iso(-1) : undefined,
    emergencyRequest: {
      id: 'qa-emergency-1',
      emergencyReference: 'SOS-2026-042674',
      bloodType: 'O',
      rhFactor: 'POSITIVE',
      urgencyLevel: 'CRITICAL',
      status: 'ACTIVE',
      donationLocation: 'Emergency entrance, ground floor',
      latitude: '40.1158',
      longitude: '67.8422',
      hospital: HOSPITAL,
    },
    locations: [],
  };
}

/** A courier with a delivery in progress, for the courier screens. */
export const COURIER = {
  active: {
    id: 'qa-shipment-1',
    shipmentReference: 'SHP-2026-0041',
    status: 'IN_TRANSIT',
    priority: 'URGENT',
    pickupAt: iso(-35),
    expectedDeliveryAt: iso(25),
    origin: { id: 'qa-center', name: 'Republican Blood Center — Jizzakh', address: "Navoi ko'chasi 8" },
    destination: HOSPITAL,
    items: [{ id: 'qa-item-1', bloodType: 'O', rhFactor: 'NEGATIVE', componentType: 'RED_CELLS', units: 2 }],
    temperatureRange: { minC: 2, maxC: 6 },
  },
  empty: null,
};
