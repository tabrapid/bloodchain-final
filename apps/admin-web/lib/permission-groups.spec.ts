import { describe, expect, it } from 'vitest';
import { createLocalization, SUPPORTED_LOCALES } from '@bloodchain/i18n';

import { permissionGroup, permissionGroupLabel } from './permission-groups';

/**
 * S6: the Roles & Permissions page groups permissions by the prefix of their
 * database code. That prefix used to be the heading, with the underscores
 * knocked out and CSS upper-casing it — so an Uzbek-speaking administrator
 * deciding what a role may do read `BLOOD CENTER` and `BLOOD TEST`.
 *
 * The set of prefixes is open: it comes from the seed, and a permission added
 * next sprint brings a prefix the catalogue has not met. These tests hold both
 * halves — the known prefixes are translated, and an unknown one stays a
 * readable phrase rather than becoming a raw key on screen.
 */
describe('permissionGroup', () => {
  it('takes the prefix of a permission code', () => {
    expect(permissionGroup('donor.read.self')).toBe('donor');
    expect(permissionGroup('blood_center.manage')).toBe('blood_center');
  });

  it('returns the whole code when there is no prefix to take', () => {
    expect(permissionGroup('standalone')).toBe('standalone');
  });
});

describe('permissionGroupLabel', () => {
  const groups = [
    'admin',
    'analytics',
    'audit',
    'blood_center',
    'blood_test',
    'courier',
    'donor',
    'hospital',
    'inventory',
    'organization',
    'shipment',
    'user',
  ];

  it.each(SUPPORTED_LOCALES)('translates every seeded group in %s', (locale) => {
    const { t } = createLocalization(locale);

    for (const group of groups) {
      const label = permissionGroupLabel(t, group);

      expect(label).toBe(t(`permissionGroups.${group}`));
      // Neither the raw key nor the raw database prefix.
      expect(label).not.toContain('permissionGroups.');
      expect(label).not.toContain('_');
    }
  });

  it('keeps an unknown group readable instead of showing the catalogue key', () => {
    const { t } = createLocalization('en');

    // A permission code prefix nobody has written a word for yet.
    expect(permissionGroupLabel(t, 'cold_chain')).toBe('Cold chain');
    expect(permissionGroupLabel(t, 'telemetry')).toBe('Telemetry');
    expect(permissionGroupLabel(t, 'cold_chain')).not.toContain('permissionGroups');
  });

  it('survives a malformed prefix rather than rendering nothing', () => {
    const { t } = createLocalization('en');

    expect(permissionGroupLabel(t, '')).toBe('');
    expect(permissionGroupLabel(t, '___')).toBe('___');
  });
});
