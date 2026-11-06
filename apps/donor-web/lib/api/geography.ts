import { apiRequest } from './client';
import { apiBasePath } from './config';

/**
 * Where a row came from.
 *
 * `OFFICIAL_REFERENCE` is published administrative data -- today that is the
 * ISO 3166-2:UZ region list. `DEMO` is placeholder data the project made up to
 * have something to filter by, and a screen that renders it without saying so
 * is presenting an invented district as a real one.
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

export async function getRegions(): Promise<Region[]> {
  return apiRequest(`${apiBasePath}/geography/regions`);
}

export async function getDistricts(regionId?: string): Promise<District[]> {
  const query = regionId ? `?regionId=${encodeURIComponent(regionId)}` : '';
  return apiRequest(`${apiBasePath}/geography/districts${query}`);
}

export async function getGeographyCoverage(): Promise<GeographyCoverage> {
  return apiRequest(`${apiBasePath}/geography/coverage`);
}

/**
 * The name to show, in the locale the app is running in.
 *
 * Place names are not translated at render time -- they are three separate
 * columns, because "Toshkent shahri" and "город Ташкент" are both the name and
 * neither is a translation of the other. English is the fallback because it is
 * the only one guaranteed to be filled in.
 */
export function geoName(
  place: { nameUz: string; nameRu: string; nameEn: string },
  locale: string,
): string {
  if (locale.startsWith('uz')) return place.nameUz || place.nameEn;
  if (locale.startsWith('ru')) return place.nameRu || place.nameEn;
  return place.nameEn;
}
