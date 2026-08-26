import { describe, expect, it } from 'vitest';
import {
  bookAppointmentSchema,
  cancelAppointmentSchema,
  changePasswordSchema,
  emailSchema,
  idSchema,
  loginSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
  refreshSchema,
  registerSchema,
  rescheduleAppointmentSchema,
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
