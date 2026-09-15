import { GeoDataSource } from '@prisma/client';

/**
 * Districts for the demo environment — and only for it.
 *
 * Every row here is `DEMO`. That is not a formality: the district level of
 * Uzbekistan's administrative division has roughly 200 entries maintained in
 * the MHOBT/SOATO classifier, and this file is not that classifier. It holds
 * the handful of districts the seeded demo organizations sit in, so that
 * region → district filtering has something to filter, and it says so on every
 * row rather than letting a reader assume the table is complete.
 *
 * A production deployment replaces this with a sourced import and flips those
 * rows to `OFFICIAL_REFERENCE`. Until then `GET /geography/districts` reports
 * `source: "DEMO"` on each entry and the directory badges them, so nobody
 * builds on this as if it were authoritative. See docs/geography.md.
 */
export interface DistrictReference {
  /** ISO code of the region this district belongs to. */
  regionCode: string;
  /** Slug, unique within the region. */
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  sortOrder: number;
}

export const DEMO_DISTRICTS: readonly DistrictReference[] = [
  // Tashkent city
  { regionCode: 'UZ-TK', code: 'yunusobod', nameUz: 'Yunusobod tumani', nameRu: 'Юнусабадский район', nameEn: 'Yunusabad District', sortOrder: 1 },
  { regionCode: 'UZ-TK', code: 'mirzo-ulugbek', nameUz: 'Mirzo Ulug‘bek tumani', nameRu: 'Мирзо-Улугбекский район', nameEn: 'Mirzo Ulugbek District', sortOrder: 2 },
  { regionCode: 'UZ-TK', code: 'chilonzor', nameUz: 'Chilonzor tumani', nameRu: 'Чиланзарский район', nameEn: 'Chilanzar District', sortOrder: 3 },
  { regionCode: 'UZ-TK', code: 'shayxontohur', nameUz: 'Shayxontohur tumani', nameRu: 'Шайхантахурский район', nameEn: 'Shaykhantakhur District', sortOrder: 4 },
  { regionCode: 'UZ-TK', code: 'yakkasaroy', nameUz: 'Yakkasaroy tumani', nameRu: 'Яккасарайский район', nameEn: 'Yakkasaray District', sortOrder: 5 },

  // Regional centres, one per region, so every region has at least one child
  { regionCode: 'UZ-AN', code: 'andijon-shahri', nameUz: 'Andijon shahri', nameRu: 'город Андижан', nameEn: 'Andijan City', sortOrder: 1 },
  { regionCode: 'UZ-BU', code: 'buxoro-shahri', nameUz: 'Buxoro shahri', nameRu: 'город Бухара', nameEn: 'Bukhara City', sortOrder: 1 },
  { regionCode: 'UZ-FA', code: 'fargona-shahri', nameUz: 'Farg‘ona shahri', nameRu: 'город Фергана', nameEn: 'Fergana City', sortOrder: 1 },
  { regionCode: 'UZ-JI', code: 'jizzax-shahri', nameUz: 'Jizzax shahri', nameRu: 'город Джизак', nameEn: 'Jizzakh City', sortOrder: 1 },
  { regionCode: 'UZ-JI', code: 'arnasoy', nameUz: 'Arnasoy tumani', nameRu: 'Арнасайский район', nameEn: 'Arnasay District', sortOrder: 2 },
  { regionCode: 'UZ-QR', code: 'nukus-shahri', nameUz: 'Nukus shahri', nameRu: 'город Нукус', nameEn: 'Nukus City', sortOrder: 1 },
  { regionCode: 'UZ-NW', code: 'navoiy-shahri', nameUz: 'Navoiy shahri', nameRu: 'город Навои', nameEn: 'Navoiy City', sortOrder: 1 },
  { regionCode: 'UZ-NG', code: 'namangan-shahri', nameUz: 'Namangan shahri', nameRu: 'город Наманган', nameEn: 'Namangan City', sortOrder: 1 },
  { regionCode: 'UZ-QA', code: 'qarshi-shahri', nameUz: 'Qarshi shahri', nameRu: 'город Карши', nameEn: 'Qarshi City', sortOrder: 1 },
  { regionCode: 'UZ-SA', code: 'samarqand-shahri', nameUz: 'Samarqand shahri', nameRu: 'город Самарканд', nameEn: 'Samarkand City', sortOrder: 1 },
  { regionCode: 'UZ-SI', code: 'guliston-shahri', nameUz: 'Guliston shahri', nameRu: 'город Гулистан', nameEn: 'Gulistan City', sortOrder: 1 },
  { regionCode: 'UZ-SU', code: 'termiz-shahri', nameUz: 'Termiz shahri', nameRu: 'город Термез', nameEn: 'Termez City', sortOrder: 1 },
  { regionCode: 'UZ-TO', code: 'nurafshon-shahri', nameUz: 'Nurafshon shahri', nameRu: 'город Нурафшан', nameEn: 'Nurafshon City', sortOrder: 1 },
  { regionCode: 'UZ-TO', code: 'chirchiq-shahri', nameUz: 'Chirchiq shahri', nameRu: 'город Чирчик', nameEn: 'Chirchiq City', sortOrder: 2 },
  { regionCode: 'UZ-XO', code: 'urganch-shahri', nameUz: 'Urganch shahri', nameRu: 'город Ургенч', nameEn: 'Urgench City', sortOrder: 1 },
] as const;

/** What every row seeded from this file records about its provenance. */
export const DEMO_DISTRICT_SOURCE: GeoDataSource = GeoDataSource.DEMO;
