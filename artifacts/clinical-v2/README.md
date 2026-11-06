# Compact clinical workspace review

Work is uncommitted on `modes`; no push or PR was created. Previous landing,
mobile and admin changes are retained.

## Implemented

- Hospital and blood-center shells use a scoped light clinical palette, compact
  default density, smaller metrics, tighter spacing, bordered/sticky table
  headers and independent scrollable worklists. Stored density preferences
  remain respected. Other portal and mobile themes are not overwritten.
- Active institution membership determines quick tasks: institution administrators
  see management/report links; staff see operational links. Dedicated laboratory
  roles get an actual filtered appointment queue instead of general analytics.
- Laboratory role navigation is limited to dashboard, laboratory, notifications
  and account. There is no role-switcher that fabricates authorization.
- Table headers support opt-in sorting, expose aria-sort, preserve source arrays,
  and keep nested action clicks separate from row selection.
- Laboratory worklist supports result-state filtering, deep-linked record selection
  and a side inspector. The inspector loads the existing result endpoint, displays
  measurement/unit/reference range/flag, and shows performed/reviewed/published
  timestamps and staff IDs returned by the server. Times use Asia/Tashkent.
- No actor or timestamp is fabricated for sample collection/receipt: the existing
  API does not expose these independent events.
- Active membership role controls offered laboratory actions. Dedicated technicians
  may enter but not review/publish; dedicated reviewers may review/publish but
  not enter. Existing broader administrator/staff role lists are retained from
  the API. Server authorization remains authoritative and was not redesigned.
- Review and publication have explicit confirmation, including the appointment
  reference and donor name. Test type selection is explicit; required measurements
  must be populated. Selecting another record cannot expose a stale result.
- Component tables show the parent donation reference. Details display component
  ID, parent donation and a real Code128 barcode encoding unitReference. This is
  an internal component label, not an ISBT 128 label/certification.
- All new interface copy is present in Uzbek, Russian and English.

## Validation

- Shared UI: 111 tests passed, including actual barcode SVG generation/recovery,
  sorting without mutation, and role-specific quick tasks.
- Blood center: 67 tests passed, including laboratory access and provenance.
- Hospital: 72 tests passed. i18n: 81 tests passed. Total: 331 tests.
- Type checks pass. Lint passes with existing warnings.
- Hospital, blood center and admin production builds passed; final blood-center
  refinements were rebuilt separately.
- Browser acceptance uses synthetic API fixtures against the actual production
  frontend builds. It checks reviewer queues, technician/reviewer action separation,
  explicit confirmation before POST, actor IDs/Tashkent times, absence of stale
  results, real barcode bars/parent linkage, and hospital layout at 1440/1024/390px.
- This is not live-backend, native-device, scanner hardware or clinical validation.

With both built portals running (hospital port 3000, center port 3002):

```bash
node artifacts/clinical-v2/check-browser.cjs
```

The cloud environment supplies Playwright and `/usr/bin/chromium`. Other machines
need those tools separately. Results are saved in `browser-results.json` and
actual rendered screenshots in this directory.

## Remaining product/backend work

- Separate director, doctor, nurse, inventory-only and auditor roles do not exist
  in the current RoleCode enum. Their own scoped endpoints/permissions and
  worklists need a separate implementation; they were not invented in the UI.
- The hospital currently has no patient registry or laboratory route equivalent
  to the center worklist. No fake patient pages, staff invitations or audit links
  were added to unsupported routes.
- Full specimen identity/collection/receipt/analysis event history with actors
  needs additional backend fields and endpoints.
- Fully separate review/publication permissions and institutional policy remain
  backend work: current endpoint role lists give some roles both actions.
- Data counts are explicitly labelled as loaded records, not platform-wide totals.
- Existing API/e2e environment prerequisites remain; no claim that the entire
  application is ready for a real clinical pilot is made.
