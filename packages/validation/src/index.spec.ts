import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createLocalization, SUPPORTED_LOCALES } from '@bloodchain/i18n';
import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  idSchema,
  loginSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
  refreshSchema,
  registerSchema,
  rescheduleAppointmentSchema,
  resetPasswordSchema,
  strongPasswordSchema,
} from './index';

describe('idSchema', () => {
  it('accepts a real cuid', () => {
    expect(idSchema.safeParse('cmt8u06bt00127de2eeeepww2').success).toBe(true);
  });

  it('rejects a plain UUID or arbitrary string', () => {
    expect(idSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(false);
    expect(idSchema.safeParse('not-an-id').success).toBe(false);
    expect(idSchema.safeParse('').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('normalizes case and trims whitespace', () => {
    const result = emailSchema.safeParse('  Donor@Example.COM  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('donor@example.com');
  });

  it('rejects an invalid email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('rejects an email over 254 characters', () => {
    const longLocal = 'a'.repeat(250);
    expect(emailSchema.safeParse(`${longLocal}@x.com`).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts a password of exactly 12 characters', () => {
    expect(passwordSchema.safeParse('123456789012').success).toBe(true);
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(passwordSchema.safeParse('short1234').success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('accepts the real seed password used throughout this project\'s dev environment', () => {
    expect(passwordSchema.safeParse('DevelopmentOnly!123').success).toBe(true);
  });
});

/**
 * Sprint 0.6 parity.
 *
 * Every API DTO that accepts a new password -- register, register-organization,
 * change-password, reset-password -- carries the same four `@Matches` rules on
 * top of the length check. The client schemas have to agree, or a form accepts
 * something the server will refuse and the user learns the rule one round trip
 * and one rejection at a time.
 *
 * Each case below is a password the API rejects. Every client schema that
 * builds a request body containing a new password must reject it too.
 */
describe('password policy parity with the API', () => {
  const rejected: Array<[string, string]> = [
    ['too short', 'Ab1!efg'],
    ['no uppercase', 'developmentonly!123'],
    ['no lowercase', 'DEVELOPMENTONLY!123'],
    ['no number', 'DevelopmentOnly!abc'],
    ['no special character', 'DevelopmentOnly1234'],
    ['over 128 characters', `Aa1!${'x'.repeat(126)}`],
  ];
  const accepted = 'DevelopmentOnly!123';

  describe.each(rejected)('a password with %s', (_label, password) => {
    it('is rejected by strongPasswordSchema', () => {
      expect(strongPasswordSchema.safeParse(password).success).toBe(false);
    });

    it('is rejected by registerSchema', () => {
      const result = registerSchema.safeParse({
        email: 'donor@example.com',
        password,
        firstName: 'Aziz',
        lastName: 'Karimov',
      });
      expect(result.success).toBe(false);
    });

    it('is rejected by changePasswordSchema', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'whatever-is-stored',
        newPassword: password,
      });
      expect(result.success).toBe(false);
    });

    it('is rejected by resetPasswordSchema', () => {
      const result = resetPasswordSchema.safeParse({ token: 'a'.repeat(64), newPassword: password });
      expect(result.success).toBe(false);
    });
  });

  it('accepts a password that satisfies every rule, everywhere', () => {
    expect(strongPasswordSchema.safeParse(accepted).success).toBe(true);
    expect(
      registerSchema.safeParse({
        email: 'donor@example.com',
        password: accepted,
        firstName: 'Aziz',
        lastName: 'Karimov',
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: accepted }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({ token: 'a'.repeat(64), newPassword: accepted }).success,
    ).toBe(true);
  });

  /**
   * Sign-in is the one place the policy must NOT apply: it checks the password
   * against what is already stored, and an account created before a policy
   * change still has to be able to get in and change it.
   */
  it('does not apply the policy to sign-in', () => {
    expect(loginSchema.safeParse({ email: 'donor@example.com', password: 'old-weak' }).success).toBe(
      true,
    );
  });
});

describe('phoneSchema', () => {
  it('accepts a valid international number', () => {
    expect(phoneSchema.safeParse('+14155550100').success).toBe(true);
  });

  it('rejects a number missing the leading +', () => {
    expect(phoneSchema.safeParse('14155550100').success).toBe(false);
  });

  it('rejects a number starting with +0', () => {
    expect(phoneSchema.safeParse('+0415550100').success).toBe(false);
  });

  it('rejects a number with too few digits after the country code', () => {
    expect(phoneSchema.safeParse('+123456').success).toBe(false);
  });

  it('rejects a number with too many total digits', () => {
    expect(phoneSchema.safeParse('+1234567890123456').success).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(phoneSchema.safeParse('  +14155550100  ').success).toBe(true);
  });
});

describe('nameSchema', () => {
  it('rejects an empty or whitespace-only name', () => {
    expect(nameSchema.safeParse('').success).toBe(false);
    expect(nameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects a name over 80 characters', () => {
    expect(nameSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });

  it('accepts a normal name', () => {
    expect(nameSchema.safeParse('Aziz').success).toBe(true);
  });
});

describe('registerSchema', () => {
  const valid = {
    email: 'donor@example.com',
    password: 'DevelopmentOnly!123',
    firstName: 'Aziz',
    lastName: 'Karimov',
  };

  it('accepts a valid payload without a phone number (optional field)', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a valid payload with a phone number', () => {
    expect(registerSchema.safeParse({ ...valid, phone: '+14155550100' }).success).toBe(true);
  });

  it('rejects when the password is too weak', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('rejects an invalid phone number when one is provided', () => {
    expect(registerSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { firstName, ...withoutFirstName } = valid;
    void firstName;
    expect(registerSchema.safeParse(withoutFirstName).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password (no strength requirement on login)', () => {
    expect(loginSchema.safeParse({ email: 'donor@example.com', password: 'x' }).success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'donor@example.com', password: '' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('rejects an empty refresh token', () => {
    expect(refreshSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });

  it('accepts a non-empty refresh token', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'a-real-token' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('requires the new password to meet the strength policy even if the current one does not', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'x',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid current + new password pair', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'OldPassword!123',
      newPassword: 'NewPassword!456',
    });
    expect(result.success).toBe(true);
  });
});

describe('bookAppointmentSchema', () => {
  it('rejects an empty slotId', () => {
    expect(bookAppointmentSchema.safeParse({ slotId: '', appointmentType: 'BLOOD_DONATION' }).success).toBe(false);
  });

  it('accepts a valid payload without notes (optional field)', () => {
    expect(
      bookAppointmentSchema.safeParse({ slotId: 'slot-1', appointmentType: 'BLOOD_DONATION' }).success,
    ).toBe(true);
  });

  it('rejects notes over 500 characters', () => {
    expect(
      bookAppointmentSchema.safeParse({
        slotId: 'slot-1',
        appointmentType: 'BLOOD_DONATION',
        notes: 'a'.repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe('cancelAppointmentSchema', () => {
  it('accepts an omitted reason (optional field)', () => {
    expect(cancelAppointmentSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a reason over 500 characters', () => {
    expect(cancelAppointmentSchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
  });
});

describe('rescheduleAppointmentSchema', () => {
  it('rejects an empty newSlotId', () => {
    expect(rescheduleAppointmentSchema.safeParse({ newSlotId: '' }).success).toBe(false);
  });

  it('accepts a non-empty newSlotId', () => {
    expect(rescheduleAppointmentSchema.safeParse({ newSlotId: 'slot-2' }).success).toBe(true);
  });
});

/**
 * Sprint 1A: every validation message in the auth flows is a catalogue key.
 *
 * These schemas are built at module load, where there is no locale, so their
 * messages are keys and the screen resolves them with `t`. That only works
 * while every key exists in every catalogue: `t` returns an unknown key
 * unchanged, so a missing one does not throw -- it renders
 * `validation.passwordNumber` under a password field, and nobody notices until
 * a user reports it.
 *
 * Zod's own defaults ("Invalid email", "String must contain at least 1
 * character(s)") are what this is really guarding against: they are English
 * sentences, they are what a rule added without a message produces, and they
 * would reach an Uzbek donor exactly as written.
 *
 * The booking schemas are deliberately absent. Their messages are still zod
 * defaults, and those screens are not part of this sprint's covered flows;
 * adding them here would fail for a reason the sprint has not addressed yet.
 */
describe('auth validation messages resolve in every language', () => {
  /** Each schema with inputs chosen to break each of its rules in turn. */
  const cases: Array<[string, z.ZodTypeAny, unknown[]]> = [
    ['emailSchema', emailSchema, ['not-an-email', `${'a'.repeat(250)}@example.com`]],
    ['passwordSchema', passwordSchema, ['short', 'a'.repeat(200)]],
    [
      'strongPasswordSchema',
      strongPasswordSchema,
      ['short', 'a'.repeat(200), 'alllowercase123!', 'ALLUPPERCASE123!', 'NoDigitsHere!!!!', 'NoSpecials1234567'],
    ],
    ['phoneSchema', phoneSchema, ['12345', '998901234567']],
    ['nameSchema', nameSchema, ['', 'a'.repeat(100)]],
    [
      'registerSchema',
      registerSchema,
      [
        { email: 'nope', password: 'weak', firstName: '', lastName: '', phone: '12345' },
        {
          email: 'someone@example.com',
          password: 'alllowercase123!',
          firstName: 'a'.repeat(100),
          lastName: 'b',
        },
      ],
    ],
    ['loginSchema', loginSchema, [{ email: 'nope', password: '' }, { email: 'a@b.co', password: 'x'.repeat(200) }]],
    [
      'changePasswordSchema',
      changePasswordSchema,
      [{ currentPassword: '', newPassword: 'weak' }, { currentPassword: 'x', newPassword: 'alllowercase123!' }],
    ],
    [
      'resetPasswordSchema',
      resetPasswordSchema,
      [{ token: '', newPassword: 'weak' }, { token: 'a'.repeat(200), newPassword: 'NoSpecials1234567' }],
    ],
    ['forgotPasswordSchema', forgotPasswordSchema, [{ email: 'nope' }]],
  ];

  /** Every message the schema actually produces for those inputs. */
  const messagesOf = (schema: z.ZodTypeAny, probes: unknown[]): string[] => {
    const found = new Set<string>();
    for (const probe of probes) {
      const result = schema.safeParse(probe);
      if (result.success) continue;
      for (const issue of result.error.issues) found.add(issue.message);
    }
    return [...found];
  };

  it.each(cases)('%s produces only catalogue keys, never an English sentence', (_name, schema, probes) => {
    const messages = messagesOf(schema, probes);
    expect(messages.length).toBeGreaterThan(0);

    const notKeys = messages.filter((message) => !/^[a-z][A-Za-z]*(\.[A-Za-z]+)+$/.test(message));
    expect(notKeys).toEqual([]);
  });

  it.each(cases)('%s resolves in Uzbek, Russian and English', (_name, schema, probes) => {
    for (const locale of SUPPORTED_LOCALES) {
      const { t } = createLocalization(locale);
      const unresolved = messagesOf(schema, probes).filter((message) => t(message) === message);
      expect({ locale, unresolved }).toEqual({ locale, unresolved: [] });
    }
  });
});
