import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../bootstrap';
import { AdminUpdatePlatformSettingsDto } from '../modules/admin/dto/admin.dto';
import { UpdateDonorProfileDto } from '../modules/donors/dto/update-donor-profile.dto';
import { UpdateEducationalContentDto } from '../modules/education/dto/education.dto';
import { UpdateLeaderboardVisibilityDto } from '../modules/gamification/dto/gamification.dto';
import { UpdateLocationDto } from '../modules/inventory/dto/inventory.dto';
import { UpdateNotificationPreferencesDto } from '../modules/notifications/dto/notification-preference.dto';
import { UpdatePushDeviceDto } from '../modules/notifications/dto/push-device.dto';
import {
  DiscoverOrganizationsQueryDto,
  OrganizationDirectoryQueryDto,
  SetOrganizationVerificationDto,
  UpdateOrganizationDirectoryDto,
} from '../modules/organizations/dto/organization-directory.dto';

/**
 * The real DTOs, through the real pipe.
 *
 * `strict-boolean.decorator.spec.ts` proves the decorator behaves; this proves
 * it is actually on the fields that matter. The two are separate on purpose: a
 * correct decorator nobody applied is exactly the state this sprint started in.
 *
 * Every case here is driven through `ValidationPipe.transform` with the options
 * `bootstrap.ts` configures, so what the test sees is what a request sees --
 * including `enableImplicitConversion`, which is what made `"false"` mean true.
 */
const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

async function send<T>(
  metatype: new () => T,
  payload: Record<string, unknown>,
  type: 'body' | 'query' = 'body',
): Promise<T> {
  return (await pipe.transform(payload, { type, metatype, data: '' } as ArgumentMetadata)) as T;
}

async function rejects<T>(
  metatype: new () => T,
  payload: Record<string, unknown>,
  type: 'body' | 'query' = 'body',
) {
  await expect(send(metatype, payload, type)).rejects.toMatchObject({ status: 400 });
}

/** The spellings this API refuses on every boolean, everywhere. */
const AMBIGUOUS = ['1', '0', 'yes', 'no', 'on', 'off', '', 'maybe'];

describe('platform settings: maintenance mode', () => {
  it('cannot be switched on by the string "false"', async () => {
    const dto = await send(AdminUpdatePlatformSettingsDto, { maintenanceMode: 'false' });
    expect(dto.maintenanceMode).toBe(false);
  });

  it('is switched on only by true or "true"', async () => {
    expect((await send(AdminUpdatePlatformSettingsDto, { maintenanceMode: true })).maintenanceMode)
      .toBe(true);
    expect((await send(AdminUpdatePlatformSettingsDto, { maintenanceMode: 'true' })).maintenanceMode)
      .toBe(true);
  });

  it.each(AMBIGUOUS)('refuses %p rather than reading it as on', async (value) => {
    await rejects(AdminUpdatePlatformSettingsDto, { maintenanceMode: value });
  });

  it('leaves the flag alone when the patch does not mention it', async () => {
    const dto = await send(AdminUpdatePlatformSettingsDto, { sessionTimeoutMinutes: 60 });
    expect(dto.maintenanceMode).toBeUndefined();
  });
});

describe('platform settings: the other feature flags', () => {
  const flags = [
    'aiHealthInsightsEnabled',
    'sosEmergencyEnabled',
    'gamificationEnabled',
    'pushNotificationsEnabled',
  ] as const;

  it.each(flags)('%s: "false" stays false', async (flag) => {
    const dto = await send(AdminUpdatePlatformSettingsDto, { [flag]: 'false' });
    expect(dto[flag]).toBe(false);
  });

  it.each(flags)('%s: "true" becomes true', async (flag) => {
    const dto = await send(AdminUpdatePlatformSettingsDto, { [flag]: 'true' });
    expect(dto[flag]).toBe(true);
  });

  it.each(flags)('%s: "1" is refused', async (flag) => {
    await rejects(AdminUpdatePlatformSettingsDto, { [flag]: '1' });
  });
});

describe('donor profile: location consent', () => {
  it('cannot be granted by the string "false"', async () => {
    const dto = await send(UpdateDonorProfileDto, { consentLocation: 'false' });
    expect(dto.consentLocation).toBe(false);
  });

  it('is granted only by true or "true"', async () => {
    expect((await send(UpdateDonorProfileDto, { consentLocation: true })).consentLocation).toBe(true);
    expect((await send(UpdateDonorProfileDto, { consentLocation: 'true' })).consentLocation).toBe(true);
  });

  it.each(AMBIGUOUS)('refuses %p rather than reading it as consent', async (value) => {
    await rejects(UpdateDonorProfileDto, { consentLocation: value });
  });

  it('is untouched by a patch that does not mention it', async () => {
    const dto = await send(UpdateDonorProfileDto, { city: 'Tashkent' });
    expect(dto.consentLocation).toBeUndefined();
  });
});

describe('organization directory filters', () => {
  const filters = ['verified', 'acceptsDonations', 'providesLaboratory'] as const;

  it.each(filters)('%s=false narrows to false, in a query string', async (filter) => {
    const dto = await send(OrganizationDirectoryQueryDto, { [filter]: 'false' }, 'query');
    expect(dto[filter]).toBe(false);
  });

  it.each(filters)('%s=true narrows to true, in a query string', async (filter) => {
    const dto = await send(OrganizationDirectoryQueryDto, { [filter]: 'true' }, 'query');
    expect(dto[filter]).toBe(true);
  });

  it.each(filters)('%s=1 is refused', async (filter) => {
    await rejects(OrganizationDirectoryQueryDto, { [filter]: '1' }, 'query');
  });

  it('applies the same rules to donor discovery, which extends the same DTO', async () => {
    const dto = await send(DiscoverOrganizationsQueryDto, { acceptsDonations: 'false' }, 'query');
    expect(dto.acceptsDonations).toBe(false);
    await rejects(DiscoverOrganizationsQueryDto, { acceptsDonations: 'yes' }, 'query');
  });

  it('applies them to the directory edit body too', async () => {
    const dto = await send(UpdateOrganizationDirectoryDto, { acceptsDonations: 'false' });
    expect(dto.acceptsDonations).toBe(false);
    await rejects(UpdateOrganizationDirectoryDto, { providesLaboratory: 'no' });
  });

  it('will not verify an organization on the strength of a non-boolean', async () => {
    expect((await send(SetOrganizationVerificationDto, { verified: 'false' })).verified).toBe(false);
    await rejects(SetOrganizationVerificationDto, { verified: 'no' });
    await rejects(SetOrganizationVerificationDto, {});
  });

  it('reads a closed opening-hours day from the word, not from truthiness', async () => {
    const dto = await send(UpdateOrganizationDirectoryDto, {
      hours: [{ dayOfWeek: 0, isClosed: 'false' }],
    });
    expect(dto.hours?.[0]?.isClosed).toBe(false);
    await rejects(UpdateOrganizationDirectoryDto, { hours: [{ dayOfWeek: 0, isClosed: '0' }] });
  });
});

describe('notification and privacy toggles', () => {
  const toggles = [
    'emergencyRequests',
    'appointments',
    'donationReminders',
    'healthResults',
    'gamification',
    'bloodRequests',
    'shipments',
    'inventory',
    'system',
    'security',
    'quietHoursEnabled',
    'emergencyOverride',
  ] as const;

  it.each(toggles)('%s: switching off with "false" does not switch it on', async (toggle) => {
    const dto = await send(UpdateNotificationPreferencesDto, { [toggle]: 'false' });
    expect(dto[toggle]).toBe(false);
  });

  it.each(toggles)('%s: "true" switches it on', async (toggle) => {
    const dto = await send(UpdateNotificationPreferencesDto, { [toggle]: 'true' });
    expect(dto[toggle]).toBe(true);
  });

  it.each(toggles)('%s: an ambiguous value is refused', async (toggle) => {
    await rejects(UpdateNotificationPreferencesDto, { [toggle]: 'off' });
  });

  it('turns one toggle off without disturbing the others', async () => {
    const dto = await send(UpdateNotificationPreferencesDto, { emergencyRequests: 'false' });
    expect(dto.emergencyRequests).toBe(false);
    expect(dto.appointments).toBeUndefined();
    expect(dto.security).toBeUndefined();
  });

  it('keeps a push device registration honest about being active', async () => {
    expect((await send(UpdatePushDeviceDto, { isActive: 'false' })).isActive).toBe(false);
    await rejects(UpdatePushDeviceDto, { isActive: '1' });
  });
});

describe('the remaining content and inventory flags', () => {
  it('will not publish educational content on the strength of "false"', async () => {
    expect((await send(UpdateEducationalContentDto, { isActive: 'false' })).isActive).toBe(false);
    await rejects(UpdateEducationalContentDto, { isActive: 'yes' });
  });

  it('will not reactivate an inventory location on the strength of "false"', async () => {
    expect((await send(UpdateLocationDto, { active: 'false' })).active).toBe(false);
    await rejects(UpdateLocationDto, { active: '1' });
  });

  it('will not publish a donor to the leaderboard on the strength of "false"', async () => {
    expect((await send(UpdateLeaderboardVisibilityDto, { visible: 'false' })).visible).toBe(false);
    await rejects(UpdateLeaderboardVisibilityDto, { visible: 'yes' });
    await rejects(UpdateLeaderboardVisibilityDto, {});
  });
});
