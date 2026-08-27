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

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must be in international format (+1234567890)');

export const nameSchema = z.string().trim().min(1).max(80);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
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
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
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
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
