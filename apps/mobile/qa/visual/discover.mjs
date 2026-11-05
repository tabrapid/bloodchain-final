/**
 * What the harness needs from a running API before it can photograph anything.
 *
 * Deep-linking a wizard step means supplying the same URL parameters the step
 * before it would have supplied -- an organization id, a test type, a slot.
 * Writing those down would make the harness valid for exactly one seeded
 * database, so it asks the API instead, with the seeded donor's own session.
 *
 * Accounts come from apps/api/prisma/seed.ts, which is where this project keeps
 * its development credentials. Nothing here is a secret and nothing here is
 * invented: `pnpm --filter @bloodchain/api prisma:seed` prints the same list.
 */
export const ACCOUNTS = {
  donor: { email: 'donor@donor.local', password: 'DevelopmentOnly!123' },
  courier: { email: 'courier@donor.local', password: 'DevelopmentOnly!123' },
};

const BASE = '/api/v1';

async function request(api, path, token) {
  const response = await fetch(`${api}${BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return undefined;
  const body = await response.json().catch(() => undefined);
  return body?.data;
}

export async function signIn(api, account) {
  const response = await fetch(`${api}${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!response.ok) {
    throw new Error(
      `Sign-in failed for ${account.email} (${response.status}). Is the API running with a seeded database? See qa/visual/README.md.`,
    );
  }
  const { data } = await response.json();
  return { accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user };
}

const first = (value) => (Array.isArray(value) ? value[0] : undefined);
const items = (value) =>
  Array.isArray(value?.items) ? value.items : Array.isArray(value?.dates) ? value.dates : Array.isArray(value) ? value : [];

/** Real ids from the seeded database, so every deep link lands on real data. */
export async function discoverIds(api, token) {
  const [organizations, testTypes, laboratories, donations, appointments, labAppointments, results, education, campaigns, challenges, notifications, badges, achievements] =
    await Promise.all([
      request(api, '/organizations/discover', token),
      request(api, '/test-types', token),
      request(api, '/laboratories', token),
      request(api, '/donations/me', token),
      request(api, '/appointments/me', token),
      request(api, '/me/laboratory-appointments', token),
      request(api, '/me/laboratory-results', token),
      request(api, '/education', token),
      request(api, '/campaigns', token),
      request(api, '/challenges', token),
      request(api, '/notifications', token),
      request(api, '/me/gamification/badges', token),
      request(api, '/me/gamification/achievements', token),
    ]);

  const organization = first(items(organizations));
  const testType = first(items(testTypes));
  const laboratory = first(items(laboratories));
  const donation = first(items(donations));
  const allAppointments = items(appointments);
  // The detail screen only offers cancel and reschedule on an appointment that
  // has not happened yet, and the seed's first row is a completed one.
  const appointment =
    allAppointments.find((a) => ['SCHEDULED', 'CONFIRMED', 'PENDING'].includes(a.status)) ??
    allAppointments[0];
  const labAppointment = first(items(labAppointments));
  const result = first(items(results));

  const ids = {
    organizationId: organization?.id ?? organization?.organizationId,
    testTypeId: testType?.id,
    laboratoryId: laboratory?.id ?? laboratory?.organizationId,
    donationId: donation?.id,
    appointmentId: appointment?.id,
    labAppointmentId: labAppointment?.id,
    resultParameter: result?.parameters?.[0]?.parameterCode ?? result?.parameters?.[0]?.code,
    educationId: first(items(education))?.id,
    campaignId: first(items(campaigns))?.id,
    challengeId: first(items(challenges))?.id,
    notificationId: first(items(notifications))?.id,
    badgeCount: items(badges).length,
    achievementCount: items(achievements).length,
  };

  const missing = ['organizationId', 'testTypeId', 'laboratoryId', 'donationId', 'appointmentId'].filter(
    (key) => !ids[key],
  );
  if (missing.length) {
    throw new Error(
      `The API answered but these ids are missing: ${missing.join(', ')}. The database is probably not seeded -- run pnpm --filter @bloodchain/api prisma:seed.`,
    );
  }

  return ids;
}

/**
 * A date with open donation slots, and one of its slots.
 *
 * Booking's time step needs both, and "tomorrow" is not a safe guess: the seed
 * opens particular days, and a closed day photographs the empty state while
 * claiming to be the populated one.
 */
export async function discoverSlot(api, token, organizationId, type = 'BLOOD_DONATION') {
  const today = new Date();
  const to = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);
  const iso = (d) => d.toISOString().slice(0, 10);

  // A flat list of slots, each with its own startAt -- not days carrying slots.
  const slots = items(
    await request(
      api,
      `/appointments/availability?organizationId=${organizationId}&appointmentType=${type}&startDate=${iso(today)}&endDate=${iso(to)}`,
      token,
    ),
  ).filter((slot) => (slot.availableSpots ?? 0) > 0);

  const slot = slots[0];
  if (!slot) return { date: undefined, slotId: undefined };

  return { date: slot.startAt.slice(0, 10), slotId: slot.id };
}

/** The same, for a laboratory: its open dates, then that date's open slots. */
export async function discoverLabSlot(api, token, laboratoryId, testTypeId) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const to = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000);

  // This endpoint takes from/to, not startDate/endDate -- it rejects the other
  // spelling outright, which is how this was found.
  const dates = items(
    await request(
      api,
      `/laboratories/${laboratoryId}/available-dates?testTypeId=${testTypeId}&from=${iso(today)}&to=${iso(to)}`,
      token,
    ),
  );
  const open = dates.find((d) => d.isAvailable ?? (d.availableSlots ?? 0) > 0) ?? dates[0];
  const date = typeof open === 'string' ? open.slice(0, 10) : open?.date?.slice(0, 10);
  if (!date) return { date: undefined, slotId: undefined };

  const slots = items(
    await request(api, `/laboratories/${laboratoryId}/slots?testTypeId=${testTypeId}&date=${date}`, token),
  );
  return { date, slotId: slots[0]?.id };
}
