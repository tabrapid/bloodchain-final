# Uzbekistan geography and the organization directory

How the app models where things are, what part of that data is real, and what
would have to happen for the rest of it to become real.

## The model

```
Region  (viloyat / область / region)
  └── District  (tuman / район / district)
        └── Organization  (and DonorProfile)
```

Two tables, one foreign key between them, and two nullable references on each
of `Organization` and `DonorProfile`. Three separate name columns per row —
`nameUz`, `nameRu`, `nameEn` — because "Toshkent shahri" and "город Ташкент"
are both the name of the place and neither is a translation of the other. They
are data, not catalogue keys: a place name is not something the product decides.

There is no separate city or settlement table. Uzbekistan's cities of regional
significance (Nukus, Samarkand city, Bukhara city…) are districts of their
region in the official classification, so they are districts here too. A third
level would either duplicate them or leave a level empty for most of the
country.

### Why the region code is the key

`Region.code` is the ISO 3166-2:UZ code (`UZ-TK`, `UZ-SA`, …) and it is unique.
That makes the reference sync idempotent: it upserts on the code, so running it
on every deploy neither duplicates a region nor re-keys one that organizations
already point at. Renaming a region in the reference file corrects the name in
place instead of orphaning its organizations.

`District.code` is a slug, unique per region (`@@unique([regionId, code])`) —
districts have no published stable code in this dataset, and a slug that is only
unique inside its region is honest about that.

## Verified reference data vs demo data

`GeoDataSource` is on every geography row and every API response:

| Value | Means | Currently |
| --- | --- | --- |
| `OFFICIAL_REFERENCE` | From a published classifier | All 14 regions (ISO 3166-2:UZ) |
| `DEMO` | Invented so there is something to filter by | All 20 districts |

This split exists because the repo did not contain an authoritative
region/district dataset and inventing one silently would put made-up
administrative units into a database that looks authoritative. The regions are
real and can be cited. The districts are not a complete or official list, and
every client is told so on every row.

`GET /geography/coverage` reports the split:

```json
{
  "regions":   { "total": 14, "official": 14, "demo": 0 },
  "districts": { "total": 20, "official": 0,  "demo": 20 },
  "districtsAuthoritative": false,
  "regionStandard": "ISO 3166-2:UZ"
}
```

`districtsAuthoritative` is computed (`every district row is OFFICIAL_REFERENCE`),
not configured. The mobile booking screen renders a "district names are sample
data" line whenever it is false, so a deployment that imports a real classifier
stops showing that line without anyone editing a client.

### Importing a real district classifier

The national classifier is SOATO / MHOBT, maintained by the State Committee on
Statistics. Importing it means:

1. Put the source file in `apps/api/prisma/seeds/` with its issue date and
   provenance in a header comment, the same way
   `src/modules/geography/uz-regions.reference.ts` documents the ISO list.
2. Map each classifier entry's region to an ISO 3166-2:UZ code. This is the only
   judgement in the import; everything else is mechanical.
3. Replace `DEMO_DISTRICTS` with the imported list and set
   `DEMO_DISTRICT_SOURCE` to `OFFICIAL_REFERENCE`.
4. Run `GeographyService.syncReferenceData()`. Districts are upserted on
   `(regionId, code)`, so any district whose slug survives keeps its id and every
   organization pointing at it stays pointed at it. Districts that do not survive
   are *not* deleted by the sync — `District.regionId` is `ON DELETE RESTRICT`
   and organizations reference districts, so removing one is a deliberate
   migration, not a side effect of a sync.
5. `districtsAuthoritative` flips to true on its own, and the demo-data notices
   disappear.

Nothing in the application logic depends on the district list being demo data.
The only difference is what the clients say about it.

## The organization directory

Beyond name, type and status, an organization now carries:

| Field | Notes |
| --- | --- |
| `regionId`, `districtId` | Optional. A district must belong to the region it is filed under; the service rejects the mismatch. |
| `address`, `directionsNote` | Free text. The street line and "the entrance is behind the pharmacy". |
| `latitude`, `longitude` | Optional; only rows that have both take part in radius search. |
| `publicPhone` | The number to print, separate from `phone`, which is the operational contact. |
| `acceptsDonations` | Whether a donor can book a donation here. |
| `providesLaboratory` | Whether it runs laboratory testing. |
| `services` | `OrganizationServiceType[]`, a set rather than a patch: an omitted service means "no longer offered". |
| `hours` | One row per weekday (0 = Sunday). A day marked closed stores no times. |
| `verifiedAt`, `verifiedById` | Platform-administrator judgement. Deliberately not editable through the directory form: an organization must not verify itself by saving its own address. |
| `isDemo` | True for every seeded demo organization. |

`isVerified` is returned alongside `verifiedAt` on every response, because a
screen asks "is this verified", not "when" — and if each caller derived the
predicate itself, they would eventually derive it differently.

### Discovery

`GET /organizations/discover` is the donor-facing list. It only ever returns
`ACTIVE` organizations — the status filter is overwritten, not defaulted, so a
donor cannot widen it to suspended sites by passing `status`.

Radius search runs in two stages: a bounding box the database can index, then an
exact great-circle distance in memory. The page is cut *after* the distance
filter, because the box admits corners the circle does not and paginating first
would return short pages and a wrong total. All three of `latitude`, `longitude`
and `radiusKm` are required together; two of the three is a client bug, and
guessing the third would answer a question nobody asked.

### Demo organizations

`apps/api/prisma/seeds/uz-demo-organizations.ts` seeds 17 fictional
organizations — four in Tashkent city so radius search has something to sort,
one in every other region so no region filter is a dead end.

Every one of them is invented. None is, or is named after, a real hospital or
blood centre: the names are "Demo" plus a generic facility word plus the place,
the emails are `.local` addresses and the phone numbers are `+998 71 000 00 00`.
Every row sets `isDemo: true` and the clients badge it. Naming a real
institution here would put claims about its opening hours, services and
verification status into a database that looks authoritative, which is not ours
to make.

## Backward compatibility

The migration (`20260915102620_add_uzbekistan_geography_and_org_directory`) is
additive only: no column is dropped, renamed or retyped, no row is deleted, and
every new column is nullable or carries a default. Organization ids,
appointments and memberships are untouched.

Donor profiles keep their free-text `city` and `district` **alongside** the new
`regionId`/`districtId`. Nothing was migrated from one to the other: mapping a
typed city name onto an administrative unit is a guess, and a guess about where
someone lives is not an improvement over what they typed.

Two backfills preserve behaviour rather than inventing facts:

- `acceptsDonations = true` for active hospitals and blood centres, because
  donors had been booking donations at them all along and a `false` default
  would have silently emptied the booking list.
- `providesLaboratory = true` where a `LaboratoryProfile` already exists —
  derived from a row that is already there, not asserted.

Organizations that predate the migration have `regionId` left null rather than
guessed.

## Verifying it

`node scripts/verify-geography.mjs` runs the real compiled services against the
real database, and — when an API is listening (`VERIFY_API_URL`) — the real
endpoints over HTTP. It checks the reference/demo split, the seed, every filter,
radius search against an independently computed distance, organization
isolation, verification, and that the pre-existing rows survived. 90 checks.

Unit coverage lives in `geography.service.spec.ts` (23) and
`organizations.service.spec.ts` (47).
