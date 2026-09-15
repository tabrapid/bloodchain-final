import { GeoDataSource } from '@prisma/client';

/**
 * The top-level administrative divisions of Uzbekistan.
 *
 * Source: ISO 3166-2:UZ — twelve viloyats, the Republic of Karakalpakstan, and
 * the city of Tashkent. This list is complete and stable, which is why it is
 * checked into the repository as reference data rather than seeded as demo
 * scaffolding, and why `code` (not a generated id) is the natural key: a
 * re-seed is an upsert on the ISO code and cannot duplicate a region.
 *
 * The district level is NOT here. A complete, sourced list of the ~200 tumans
 * is not in this repository, and writing one from memory would put fabricated
 * administrative data in front of people who would reasonably read it as
 * official. See docs/geography.md for what importing a real one involves.
 *
 * Uzbek names are the Latin orthography in official use. Russian names are the
 * conventional Russian renderings, not transliterations of the Uzbek.
 */
export interface RegionReference {
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  /** Administrative centre, for orientation in a picker. */
  centerEn: string;
  /** Alphabetical by Uzbek name, with Tashkent city first as the capital. */
  sortOrder: number;
}

export const UZ_REGIONS: readonly RegionReference[] = [
  { code: 'UZ-TK', nameUz: 'Toshkent shahri', nameRu: 'город Ташкент', nameEn: 'Tashkent City', centerEn: 'Tashkent', sortOrder: 1 },
  { code: 'UZ-AN', nameUz: 'Andijon viloyati', nameRu: 'Андижанская область', nameEn: 'Andijan Region', centerEn: 'Andijan', sortOrder: 2 },
  { code: 'UZ-BU', nameUz: 'Buxoro viloyati', nameRu: 'Бухарская область', nameEn: 'Bukhara Region', centerEn: 'Bukhara', sortOrder: 3 },
  { code: 'UZ-FA', nameUz: 'Farg‘ona viloyati', nameRu: 'Ферганская область', nameEn: 'Fergana Region', centerEn: 'Fergana', sortOrder: 4 },
  { code: 'UZ-JI', nameUz: 'Jizzax viloyati', nameRu: 'Джизакская область', nameEn: 'Jizzakh Region', centerEn: 'Jizzakh', sortOrder: 5 },
  { code: 'UZ-QR', nameUz: 'Qoraqalpog‘iston Respublikasi', nameRu: 'Республика Каракалпакстан', nameEn: 'Republic of Karakalpakstan', centerEn: 'Nukus', sortOrder: 6 },
  { code: 'UZ-NW', nameUz: 'Navoiy viloyati', nameRu: 'Навоийская область', nameEn: 'Navoiy Region', centerEn: 'Navoiy', sortOrder: 7 },
  { code: 'UZ-NG', nameUz: 'Namangan viloyati', nameRu: 'Наманганская область', nameEn: 'Namangan Region', centerEn: 'Namangan', sortOrder: 8 },
  { code: 'UZ-QA', nameUz: 'Qashqadaryo viloyati', nameRu: 'Кашкадарьинская область', nameEn: 'Qashqadaryo Region', centerEn: 'Qarshi', sortOrder: 9 },
  { code: 'UZ-SA', nameUz: 'Samarqand viloyati', nameRu: 'Самаркандская область', nameEn: 'Samarkand Region', centerEn: 'Samarkand', sortOrder: 10 },
  { code: 'UZ-SI', nameUz: 'Sirdaryo viloyati', nameRu: 'Сырдарьинская область', nameEn: 'Sirdaryo Region', centerEn: 'Gulistan', sortOrder: 11 },
  { code: 'UZ-SU', nameUz: 'Surxondaryo viloyati', nameRu: 'Сурхандарьинская область', nameEn: 'Surxondaryo Region', centerEn: 'Termez', sortOrder: 12 },
  { code: 'UZ-TO', nameUz: 'Toshkent viloyati', nameRu: 'Ташкентская область', nameEn: 'Tashkent Region', centerEn: 'Nurafshon', sortOrder: 13 },
  { code: 'UZ-XO', nameUz: 'Xorazm viloyati', nameRu: 'Хорезмская область', nameEn: 'Khorezm Region', centerEn: 'Urgench', sortOrder: 14 },
] as const;

/** What every row seeded from this file records about its provenance. */
export const REGION_SOURCE: GeoDataSource = GeoDataSource.OFFICIAL_REFERENCE;
