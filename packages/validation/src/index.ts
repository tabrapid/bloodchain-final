import { z } from 'zod';
import {
  APPOINTMENT_TYPES,
  BLOOD_TYPES,
  DONOR_STATUSES,
  ORGANIZATION_TYPES,
  RH_FACTORS,
  USER_ROLES,
} from '@bloodchain/types';

export const idSchema = z.string().cuid();

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * The length rule on its own.
 *
 * Not enough on its own for anything the API will accept as a new password --
 * every DTO that takes one (register, register-organization, change-password,
 * reset-password) also requires an uppercase, a lowercase, a number and a
 * symbol. Build on `strongPasswordSchema` below for those; this exists as its
 * base and for the length message.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

/**
 * The password policy the API actually enforces, in one place.
 *
 * Declared above the schemas that use it so it can be their single source: the
 * four server DTOs carry identical `@Matches` rules, and a form built on
 * `passwordSchema` alone accepted a 12-character all-lowercase password, then
 * spent a round trip to be told four things it could have said itself.
 */
export const strongPasswordSchema = passwordSchema
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must be in international format (+1234567890)');

export const nameSchema = z.string().trim().min(1).max(80);

export const registerSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  // Any string, because it is checked against what is already stored -- an
  // account created before a policy change must still be able to move off it.
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Mirrors the server's ResetPasswordDto exactly: this is the request body, not
 * the form. A confirm-password field is a property of the form that builds this
 * body, so it belongs to the screen rather than to the contract.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(128),
  newPassword: strongPasswordSchema,
});

export const organizationTypeSchema = z.enum(ORGANIZATION_TYPES);

export const roleSchema = z.enum(USER_ROLES);

export const bloodTypeSchema = z.enum(BLOOD_TYPES);

export const rhFactorSchema = z.enum(RH_FACTORS);

export const donorStatusSchema = z.enum(DONOR_STATUSES);

export const appointmentTypeSchema = z.enum(APPOINTMENT_TYPES);

export const bookAppointmentSchema = z.object({
  slotId: z.string().min(1),
  appointmentType: appointmentTypeSchema,
  notes: z.string().max(500).optional(),
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  newSlotId: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
