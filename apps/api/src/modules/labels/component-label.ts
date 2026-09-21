import { BloodGroupProvenance, BloodType, ComponentType, RhFactor } from '@prisma/client';

/**
 * What goes on a component label, and what must never.
 *
 * A pure function over a plain record, deliberately. A label is the one place
 * where the whole traceability chain becomes a physical object that leaves the
 * building, and the interesting property is not what it contains but what it
 * cannot contain. That property is only testable if building a label needs
 * nothing but data -- no database, no request, no organisation context to
 * stub -- so the rule and its proof sit next to each other here.
 *
 * NO ISBT 128 COMPLIANCE IS CLAIMED. The field set below is this project's own,
 * shaped so an ISBT 128 adapter can be written later without changing the
 * domain identifiers; `machineReadable` is a payload, not a standard-conformant
 * one, and nothing here should be read as saying otherwise.
 */

/** Fields that must never reach a component label. */
export const LABEL_DENY_LIST = [
  'donorName',
  'donorFirstName',
  'donorLastName',
  'donorPhone',
  'phone',
  'jshshir',
  'passportNumber',
  'nationalId',
  'confidentialNote',
  'clinicalNote',
  'assessmentNotes',
  'reasonText',
] as const;

export interface ComponentLabelInput {
  /** The parent donation's human-readable identifier. */
  donationIdentificationNumber: string;
  /** This component's own identifier. */
  componentReference: string;
  componentType: ComponentType;
  /** Present only when the group has been clinically verified. See below. */
  bloodType: BloodType | null;
  rhFactor: RhFactor | null;
  bloodGroupSource: BloodGroupProvenance;
  volumeMl: number | null;
  preparedAt: Date | null;
  /** Only when it is known and policy-derived; never guessed. */
  expiresAt: Date | null;
  expiryKnown: boolean;
  storagePolicyCode: string | null;
  organizationCode: string;
  processingAttributes: string[];
  /** Active holds, as kinds. Never the reason text. */
  holdKinds: string[];
}

export interface ComponentLabel {
  donationIdentificationNumber: string;
  componentReference: string;
  componentType: ComponentType;
  /**
   * The printed group, or null.
   *
   * Null unless `bloodGroupSource` is UNIT_TYPED. A donor's profile group,
   * however well verified, is not a typing of THIS bag (CL-05), and a label is
   * read by someone about to hang a unit on a patient. Printing a copied group
   * as though the unit had been grouped in a laboratory is the single most
   * dangerous thing this function could do.
   */
  bloodGroupPrinted: string | null;
  bloodGroupSource: BloodGroupProvenance;
  volumeMl: number | null;
  preparedAt: string | null;
  expiry: string | null;
  /** Said out loud rather than inferred from a blank field. */
  expiryStatement: string;
  storagePolicyCode: string | null;
  organizationCode: string;
  processingAttributes: string[];
  warnings: string[];
  machineReadable: string;
  humanReadable: string[];
}

/** Build the label data for one component. */
export function buildComponentLabel(input: ComponentLabelInput): ComponentLabel {
  const typed = input.bloodGroupSource === BloodGroupProvenance.UNIT_TYPED;
  const bloodGroupPrinted =
    typed && input.bloodType && input.rhFactor
      ? `${input.bloodType}${input.rhFactor === RhFactor.POSITIVE ? '+' : '-'}`
      : null;

  const warnings: string[] = [];

  if (!bloodGroupPrinted) {
    // Not a formatting detail. A blank group field could be read as "not yet
    // printed"; this says why it is blank.
    warnings.push('GROUP_NOT_UNIT_TYPED');
  }

  if (!input.expiryKnown || !input.expiresAt) {
    warnings.push('EXPIRY_UNKNOWN');
  }

  if (!input.storagePolicyCode) {
    warnings.push('STORAGE_POLICY_NOT_CONFIGURED');
  }

  for (const kind of input.holdKinds) {
    warnings.push(`HOLD_${kind}`);
  }

  const expiry = input.expiryKnown && input.expiresAt ? input.expiresAt.toISOString() : null;

  const humanReadable = [
    `DIN ${input.donationIdentificationNumber}`,
    `UNIT ${input.componentReference}`,
    `COMPONENT ${input.componentType}`,
    `GROUP ${bloodGroupPrinted ?? 'NOT UNIT-TYPED'}`,
    `VOLUME ${input.volumeMl === null ? 'UNRECORDED' : `${input.volumeMl} mL`}`,
    `EXPIRY ${expiry ?? 'UNKNOWN - NOT FOR RELEASE'}`,
    `ORG ${input.organizationCode}`,
  ];

  return {
    donationIdentificationNumber: input.donationIdentificationNumber,
    componentReference: input.componentReference,
    componentType: input.componentType,
    bloodGroupPrinted,
    bloodGroupSource: input.bloodGroupSource,
    volumeMl: input.volumeMl,
    preparedAt: input.preparedAt ? input.preparedAt.toISOString() : null,
    expiry,
    expiryStatement: expiry
      ? 'Expiry derived from the storage policy in force.'
      : 'No expiry is known for this component. An unknown shelf life is not a safe one.',
    storagePolicyCode: input.storagePolicyCode,
    organizationCode: input.organizationCode,
    processingAttributes: input.processingAttributes,
    warnings,
    // A payload, not a standard-conformant one. Prefixed so nothing downstream
    // mistakes it for an ISBT 128 barcode.
    machineReadable: [
      'BCHN1',
      input.donationIdentificationNumber,
      input.componentReference,
      input.componentType,
      bloodGroupPrinted ?? 'NA',
      expiry ?? 'NA',
    ].join('|'),
    humanReadable,
  };
}
