import { apiRequest } from './api-client';

/**
 * Where a geography row came from.
 *
 * `DEMO` rows are placeholder data the project made up so there is something to
 * filter by. A form that offers them without saying so is asking staff to file
 * their organization under an administrative unit that does not officially
 * exist.
 */
export type GeoDataSource = 'OFFICIAL_REFERENCE' | 'DEMO';

export interface Region {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  centerEn?: string | null;
  source: GeoDataSource;
  districtCount: number;
}

export interface District {
  id: string;
  code: string;
  regionId: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  source: GeoDataSource;
}

export interface GeographyCoverage {
  regions: { total: number; official: number; demo: number };
  districts: { total: number; official: number; demo: number };
  districtsAuthoritative: boolean;
  regionStandard: string;
}

export type OrganizationServiceType =
  | 'WHOLE_BLOOD_DONATION'
  | 'PLASMA_DONATION'
  | 'PLATELET_DONATION'
  | 'LABORATORY_TESTING'
  | 'BLOOD_TYPING'
  | 'HEALTH_SCREENING'
  | 'MOBILE_DONATION_DRIVE'
  | 'EMERGENCY_SUPPLY';

/** Every service, in the order a form should offer them. */
export const ORGANIZATION_SERVICES: OrganizationServiceType[] = [
  'WHOLE_BLOOD_DONATION',
  'PLASMA_DONATION',
  'PLATELET_DONATION',
  'LABORATORY_TESTING',
  'BLOOD_TYPING',
  'HEALTH_SCREENING',
  'MOBILE_DONATION_DRIVE',
  'EMERGENCY_SUPPLY',
];

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface DirectoryPlace {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  source: GeoDataSource;
}

export interface DirectoryOrganization {
  id: string;
  type: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  publicPhone: string | null;
  email: string | null;
  address: string | null;
  directionsNote: string | null;
  /** Prisma sends Decimal columns as strings; parse before doing arithmetic. */
  latitude: string | number | null;
  longitude: string | number | null;
  status: string;
  acceptsDonations: boolean;
  providesLaboratory: boolean;
  verifiedAt: string | null;
  isVerified: boolean;
  isDemo: boolean;
  region: DirectoryPlace | null;
  district: DirectoryPlace | null;
  services: Array<{ service: OrganizationServiceType; note: string | null }>;
  hours: OpeningHours[];
}

export interface DirectoryUpdate {
  regionId?: string | null;
  districtId?: string | null;
  address?: string | null;
  directionsNote?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  publicPhone?: string | null;
  acceptsDonations?: boolean;
  providesLaboratory?: boolean;
  services?: Array<{ service: OrganizationServiceType; note?: string }>;
  hours?: Array<{ dayOfWeek: number; opensAt?: string; closesAt?: string; isClosed?: boolean }>;
}

export async function listRegions(): Promise<Region[]> {
  return apiRequest<Region[]>('/geography/regions');
}

export async function listDistricts(regionId?: string): Promise<District[]> {
  const query = regionId ? `?regionId=${encodeURIComponent(regionId)}` : '';
  return apiRequest<District[]>(`/geography/districts${query}`);
}

export async function getGeographyCoverage(): Promise<GeographyCoverage> {
  return apiRequest<GeographyCoverage>('/geography/coverage');
}

export async function getDirectoryEntry(id: string): Promise<DirectoryOrganization> {
  return apiRequest<DirectoryOrganization>(`/organizations/${encodeURIComponent(id)}`);
}

export async function updateDirectoryEntry(
  id: string,
  input: DirectoryUpdate,
): Promise<DirectoryOrganization> {
  return apiRequest<DirectoryOrganization>(
    `/organizations/${encodeURIComponent(id)}/directory`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

/**
 * The name to show, in the locale the portal is running in.
 *
 * Place names are three columns rather than catalogue keys: "Toshkent shahri"
 * and "город Ташкент" are both the name of the place and neither is a
 * translation of the other. English is the fallback because it is the only one
 * guaranteed to be filled in.
 */
export function geoName(
  place: { nameUz: string; nameRu: string; nameEn: string },
  locale: string,
): string {
  if (locale.startsWith('uz')) return place.nameUz || place.nameEn;
  if (locale.startsWith('ru')) return place.nameRu || place.nameEn;
  return place.nameEn;
}

/** A full week of rows, so a form never has to invent the missing days. */
export function weekOfHours(hours: OpeningHours[]): OpeningHours[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const existing = hours.find((entry) => entry.dayOfWeek === dayOfWeek);
    return existing ?? { dayOfWeek, opensAt: null, closesAt: null, isClosed: true };
  });
}
