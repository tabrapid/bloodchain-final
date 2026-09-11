import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findStaleMarkers } from './demo-prisma.mjs';

const current = {
  OrganizationType: { HOSPITAL: 'HOSPITAL', BLOOD_CENTER: 'BLOOD_CENTER', SYSTEM: 'SYSTEM' },
  MovementType: { RECEIVED: 'RECEIVED', ADJUSTED: 'ADJUSTED' },
  Prisma: {
    PlatformSettingsScalarFieldEnum: { id: 'id' },
    DonorProfileScalarFieldEnum: { id: 'id', latitude: 'latitude' },
    TestReferenceRangeScalarFieldEnum: { id: 'id', parameterId: 'parameterId' },
  },
};

test('reports nothing missing for a client generated from the current schema', () => {
  assert.deepEqual(findStaleMarkers(current), []);
});

/**
 * This is the exact shape that produced 31 compile errors and a seed that could
 * not run: an enum without SYSTEM, no PlatformSettings model, no coordinates on
 * DonorProfile, no parameterId on the reference range.
 */
test('names every marker a pre-migration client is missing', () => {
  const stale = {
    OrganizationType: { HOSPITAL: 'HOSPITAL', BLOOD_CENTER: 'BLOOD_CENTER' },
    MovementType: { RECEIVED: 'RECEIVED' },
    Prisma: {
      DonorProfileScalarFieldEnum: { id: 'id' },
      TestReferenceRangeScalarFieldEnum: { id: 'id' },
    },
  };
  assert.deepEqual(findStaleMarkers(stale), [
    'OrganizationType.SYSTEM',
    'MovementType.ADJUSTED',
    'Prisma.PlatformSettingsScalarFieldEnum',
    'DonorProfile.latitude',
    'TestReferenceRange.parameterId',
  ]);
});

test('names only the marker that is actually missing', () => {
  const almost = structuredClone(current);
  delete almost.Prisma.TestReferenceRangeScalarFieldEnum.parameterId;
  assert.deepEqual(findStaleMarkers(almost), ['TestReferenceRange.parameterId']);
});

test('treats an unreadable client as entirely stale rather than throwing', () => {
  assert.equal(findStaleMarkers({}).length, 5);
});
