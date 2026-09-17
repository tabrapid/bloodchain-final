import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PrismaService } from '../../database/prisma.service';
import { AppointmentReminderService } from './appointment-reminder.service';

function appointmentIn(minutes: number, overrides: Record<string, any> = {}) {
  return {
    id: 'appt-1',
    donorId: 'donor-1',
    scheduledStart: new Date(Date.now() + minutes * 60 * 1000),
    ...overrides,
  };
}

describe('AppointmentReminderService', () => {
  let service: AppointmentReminderService;
  let prisma: any;
  let events: { emit: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    events = { emit: jest.fn() };
    config = { get: jest.fn().mockImplementation((_key: string, fallback: number) => fallback) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentReminderService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AppointmentReminderService);
  });

  it('defaults to a day ahead, and takes the configured lead time when set', () => {
    expect(service.leadMinutes).toBe(1440);

    config.get.mockReturnValue(120);
    expect(service.leadMinutes).toBe(120);
    expect(config.get).toHaveBeenCalledWith('APPOINTMENT_REMINDER_LEAD_MINUTES', 1440);
  });

  it('asks only for upcoming, un-reminded appointments inside the lead window', async () => {
    await service.sendDueReminders();

    const where = prisma.appointment.findMany.mock.calls[0][0].where;
    expect(where.reminderSentAt).toBeNull();
    expect(where.status.in).toEqual(['PENDING', 'CONFIRMED']);
    // Not in the past, and no further out than the lead time.
    expect(where.scheduledStart.gt).toBeInstanceOf(Date);
    const window = where.scheduledStart.lte.getTime() - where.scheduledStart.gt.getTime();
    expect(Math.round(window / 60000)).toBe(1440);
  });

  it('emits one reminder per due appointment, addressed to its donor', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      appointmentIn(60),
      appointmentIn(90, { id: 'appt-2', donorId: 'donor-2' }),
    ]);

    const sent = await service.sendDueReminders();

    expect(sent).toBe(2);
    expect(events.emit).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenNthCalledWith(
      1,
      'appointment.reminder',
      expect.objectContaining({ appointmentId: 'appt-1', recipientIds: ['donor-1'] }),
    );
    expect(events.emit).toHaveBeenNthCalledWith(
      2,
      'appointment.reminder',
      expect.objectContaining({ appointmentId: 'appt-2', recipientIds: ['donor-2'] }),
    );
  });

  it('reports how far ahead the reminder actually is', async () => {
    prisma.appointment.findMany.mockResolvedValue([appointmentIn(45)]);

    await service.sendDueReminders();

    const payload = events.emit.mock.calls[0][1];
    expect(payload.reminderMinutes).toBe(45);
  });

  describe('idempotence', () => {
    it('claims each appointment by stamping reminderSentAt, conditionally on it being unset', async () => {
      prisma.appointment.findMany.mockResolvedValue([appointmentIn(60)]);

      await service.sendDueReminders();

      expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appt-1', reminderSentAt: null },
        data: { reminderSentAt: expect.any(Date) },
      });
    });

    it('emits nothing when the claim loses -- another run got there first', async () => {
      // Exactly what a second cron tick, a restart mid-batch, or a second API
      // instance sees: the row it selected has been stamped since.
      prisma.appointment.findMany.mockResolvedValue([appointmentIn(60)]);
      prisma.appointment.updateMany.mockResolvedValue({ count: 0 });

      const sent = await service.sendDueReminders();

      expect(sent).toBe(0);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('sends nothing on a second run, because the query no longer returns the appointment', async () => {
      prisma.appointment.findMany.mockResolvedValueOnce([appointmentIn(60)]).mockResolvedValueOnce([]);

      expect(await service.sendDueReminders()).toBe(1);
      expect(await service.sendDueReminders()).toBe(0);
      expect(events.emit).toHaveBeenCalledTimes(1);
    });

    it('keeps going when one appointment in the batch is already claimed', async () => {
      prisma.appointment.findMany.mockResolvedValue([
        appointmentIn(60),
        appointmentIn(75, { id: 'appt-2', donorId: 'donor-2' }),
      ]);
      prisma.appointment.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });

      const sent = await service.sendDueReminders();

      expect(sent).toBe(1);
      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit.mock.calls[0][1].appointmentId).toBe('appt-2');
    });
  });
});
