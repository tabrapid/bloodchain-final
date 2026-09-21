import { BloodGroupProvenance, BloodType, ComponentType, RhFactor } from '@prisma/client';

import { LABEL_DENY_LIST, buildComponentLabel, ComponentLabelInput } from './component-label';

/**
 * The label's deny-list, and the two refusals that matter clinically.
 *
 * A label is where the traceability chain becomes a physical object that leaves
 * the building. What it must never carry is a harder property to hold than what
 * it must carry, because the second is checked by whoever reads it and the
 * first is checked by nobody.
 */
describe('component label', () => {
  const input = (overrides: Partial<ComponentLabelInput> = {}): ComponentLabelInput => ({
    donationIdentificationNumber: 'DONATION-2026-000123',
    componentReference: 'BU-2026-000456',
    componentType: ComponentType.RED_CELLS,
    bloodType: BloodType.O,
    rhFactor: RhFactor.NEGATIVE,
    bloodGroupSource: BloodGroupProvenance.UNIT_TYPED,
    volumeMl: 280,
    preparedAt: new Date('2026-09-20T10:00:00.000Z'),
    expiresAt: new Date('2026-10-01T10:00:00.000Z'),
    expiryKnown: true,
    storagePolicyCode: 'STORAGE-REF-1',
    organizationCode: 'RBC-JIZZAKH',
    processingAttributes: ['LEUCODEPLETED'],
    holdKinds: [],
    ...overrides,
  });

  describe('identifiers it carries', () => {
    it('carries the donation identification number and the component id', () => {
      const label = buildComponentLabel(input());

      expect(label.donationIdentificationNumber).toBe('DONATION-2026-000123');
      expect(label.componentReference).toBe('BU-2026-000456');
      expect(label.machineReadable).toContain('DONATION-2026-000123');
      expect(label.humanReadable.join(' ')).toContain('BU-2026-000456');
    });

    it('does not claim ISBT 128 conformance anywhere', () => {
      const label = buildComponentLabel(input());

      expect(JSON.stringify(label)).not.toMatch(/isbt/i);
      // Prefixed so nothing downstream mistakes the payload for one.
      expect(label.machineReadable.startsWith('BCHN1|')).toBe(true);
    });
  });

  describe('the deny-list', () => {
    /**
     * Asserted against the serialised label rather than field by field, because
     * the failure mode is a field somebody adds later -- not one of the fields
     * that exist today.
     */
    const forbidden = {
      donorName: 'Dilnoza Karimova',
      donorPhone: '+998901234567',
      jshshir: '12345678901234',
      confidentialNote: 'CONFIDENTIAL clinician note',
    };

    it('exposes the deny-list so it cannot drift silently', () => {
      for (const field of ['donorName', 'donorPhone', 'jshshir', 'confidentialNote']) {
        expect(LABEL_DENY_LIST).toContain(field);
      }
    });

    it('carries no donor name, phone, national id or clinical note', () => {
      // The forbidden values are passed in alongside the real input. A label
      // built by spreading its input -- the mistake this guards against --
      // would carry them straight through.
      const label = buildComponentLabel({ ...input(), ...forbidden } as ComponentLabelInput);
      const serialised = JSON.stringify(label);

      for (const value of Object.values(forbidden)) {
        expect(serialised).not.toContain(value);
      }

      for (const key of LABEL_DENY_LIST) {
        expect(Object.keys(label)).not.toContain(key);
      }
    });

    it('carries the hold KIND but never the hold reason text', () => {
      const label = buildComponentLabel(
        input({ holdKinds: ['TEMPERATURE_EXCURSION'] }),
      );

      expect(label.warnings).toContain('HOLD_TEMPERATURE_EXCURSION');
      expect(JSON.stringify(label)).not.toMatch(/reasonText|confidential/i);
    });
  });

  describe('the two refusals that matter clinically', () => {
    it('refuses to print a group that was copied from the donor profile', () => {
      // CL-05. A donor's profile group, however well verified, is not a typing
      // of THIS bag -- and a label is read by someone about to hang a unit on a
      // patient.
      const label = buildComponentLabel(
        input({ bloodGroupSource: BloodGroupProvenance.DONOR_PROFILE_COPY }),
      );

      expect(label.bloodGroupPrinted).toBeNull();
      expect(label.warnings).toContain('GROUP_NOT_UNIT_TYPED');
      expect(label.humanReadable.join(' ')).toContain('NOT UNIT-TYPED');
    });

    it('refuses to print a group recorded by collecting staff', () => {
      const label = buildComponentLabel(
        input({ bloodGroupSource: BloodGroupProvenance.STAFF_RECORDED_AT_COLLECTION }),
      );

      expect(label.bloodGroupPrinted).toBeNull();
    });

    it('prints the group only when the unit itself was typed', () => {
      const label = buildComponentLabel(input({ bloodGroupSource: BloodGroupProvenance.UNIT_TYPED }));

      expect(label.bloodGroupPrinted).toBe('O-');
      expect(label.warnings).not.toContain('GROUP_NOT_UNIT_TYPED');
    });

    it('says an unknown expiry is unknown rather than leaving it blank', () => {
      // CL-04. A blank expiry field reads as "not printed yet"; this says why.
      const label = buildComponentLabel(input({ expiryKnown: false, expiresAt: null }));

      expect(label.expiry).toBeNull();
      expect(label.warnings).toContain('EXPIRY_UNKNOWN');
      expect(label.expiryStatement).toContain('not a safe one');
      expect(label.humanReadable.join(' ')).toContain('NOT FOR RELEASE');
    });

    it('warns when no storage policy is configured, rather than printing a temperature', () => {
      const label = buildComponentLabel(input({ storagePolicyCode: null }));

      expect(label.warnings).toContain('STORAGE_POLICY_NOT_CONFIGURED');
      // No temperature is invented anywhere, in any field.
      expect(JSON.stringify(label)).not.toMatch(/-?\d+\s*°?\s*C\b/);
    });
  });
});
