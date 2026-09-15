import { apiRequest, apiRequestEnvelope } from './client';
import { apiBasePath } from './config';
import type { GeoDataSource } from './geography';

export type OrganizationServiceType =
  | 'WHOLE_BLOOD_DONATION'
  | 'PLASMA_DONATION'
  | 'PLATELET_DONATION'
  | 'LABORATORY_TESTING'
  | 'BLOOD_TYPING'
  | 'HEALTH_SCREENING'
  | 'MOBILE_DONATION_DRIVE'
  | 'EMERGENCY_SUPPLY';

export interface OrganizationPlace {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  source: GeoDataSource;
}

export interface OrganizationOpeningHours {
  /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface DirectoryOrganization {
  id: string;
  type: 'HOSPITAL' | 'BLOOD_CENTER' | 'SYSTEM';
  name: string;
  address: string | null;
  directionsNote: string | null;
  publicPhone: string | null;
  phone: string | null;
  /** Prisma sends Decimal columns as strings; parse before doing arithmetic. */
  latitude: string | number | null;
  longitude: string | number | null;
  status: string;
  acceptsDonations: boolean;
  providesLaboratory: boolean;
  isVerified: boolean;
  isDemo: boolean;
  region: OrganizationPlace | null;
  district: OrganizationPlace | null;
  services: Array<{ service: OrganizationServiceType; note: string | null }>;
  hours: OrganizationOpeningHours[];
  /** Kilometres from the coordinates the caller passed; null without a radius. */
  distanceKm: number | null;
}

export interface DiscoverParams {
  regionId?: string;
  districtId?: string;
  type?: 'HOSPITAL' | 'BLOOD_CENTER';
  service?: OrganizationServiceType;
  acceptsDonations?: boolean;
  providesLaboratory?: boolean;
  search?: string;
  /** All three of latitude, longitude and radiusKm are needed, or none. */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  page?: number;
  limit?: number;
}

export interface DiscoverResult {
  organizations: DirectoryOrganization[];
  total: number;
  totalPages: number;
  radiusKm?: number;
}

/**
 * What the donor is trying to book decides which organizations can serve them.
 *
 * The booking flow works in appointment types (`BLOOD_DONATION`), the directory
 * in capabilities (`acceptsDonations`). Sending the appointment type straight
 * through as `type` asks the server for an organization *type* that does not
 * exist and is rejected, so the translation happens here, once, rather than in
 * each screen.
 */
export function capabilityFor(appointmentType?: string): Partial<DiscoverParams> {
  switch (appointmentType) {
    case 'BLOOD_DONATION':
      return { acceptsDonations: true };
    case 'BLOOD_TEST':
      return { providesLaboratory: true };
    default:
      return {};
  }
}

export async function discoverOrganizations(
  params: DiscoverParams = {},
): Promise<DiscoverResult> {
  const query = new URLSearchParams();
  const set = (key: string, value: string | number | boolean | undefined) => {
    if (value === undefined) return;
    query.set(key, String(value));
  };

  set('regionId', params.regionId);
  set('districtId', params.districtId);
  set('type', params.type);
  set('service', params.service);
  set('acceptsDonations', params.acceptsDonations);
  set('providesLaboratory', params.providesLaboratory);
  set('search', params.search?.trim() ? params.search.trim() : undefined);
  set('page', params.page);
  set('limit', params.limit);

  // A radius without a centre is not a narrower search, it is a different one:
  // the server ignores a half-specified location, so none of the three is sent
  // unless all three are known.
  if (
    params.latitude !== undefined &&
    params.longitude !== undefined &&
    params.radiusKm !== undefined
  ) {
    set('latitude', params.latitude);
    set('longitude', params.longitude);
    set('radiusKm', params.radiusKm);
  }

  const suffix = query.toString();
  const envelope = await apiRequestEnvelope<DirectoryOrganization[]>(
    `${apiBasePath}/organizations/discover${suffix ? `?${suffix}` : ''}`,
  );
  const meta = (envelope.meta ?? {}) as {
    total?: number;
    totalPages?: number;
    radiusKm?: number;
  };
  const organizations = envelope.data ?? [];
  return {
    organizations,
    total: meta.total ?? organizations.length,
    totalPages: meta.totalPages ?? 1,
    radiusKm: meta.radiusKm,
  };
}

/**
 * One organization by id.
 *
 * Used where a screen already knows which organization it means -- the booking
 * review step, say -- instead of listing every organization and searching the
 * page that happened to come back.
 */
export async function getOrganization(id: string): Promise<DirectoryOrganization> {
  return apiRequest(`${apiBasePath}/organizations/${encodeURIComponent(id)}`);
}
