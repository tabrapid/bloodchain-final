/**
 * The appointment lifecycle events the notification handler listens for.
 *
 * They were written as string literals inside
 * `handlers/notification-event.handler.ts` and nowhere else, so the three
 * handlers -- created, reminder, cancelled -- had no emitters at all: a donor
 * booked an appointment and the platform said nothing, then the appointment
 * arrived with no reminder, then it was cancelled in silence. Naming them here
 * gives the emitters and the listener one spelling to agree on, which a typo
 * in a string literal would not have.
 */
export const APPOINTMENT_CREATED_EVENT = 'appointment.created';
export const APPOINTMENT_REMINDER_EVENT = 'appointment.reminder';
export const APPOINTMENT_CANCELLED_EVENT = 'appointment.cancelled';

export interface AppointmentCreatedPayload {
  appointmentId: string;
  scheduledAt: Date;
  recipientIds: string[];
}

export interface AppointmentReminderPayload {
  appointmentId: string;
  scheduledAt: Date;
  /** How far ahead of the appointment this reminder is going out. */
  reminderMinutes: number;
  recipientIds: string[];
}

export interface AppointmentCancelledPayload {
  appointmentId: string;
  scheduledAt: Date;
  recipientIds: string[];
}
