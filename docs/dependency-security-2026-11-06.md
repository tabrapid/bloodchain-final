# Dependency security changes — 2026-11-06

## Changes and validation scope

- Three web portals and shared web UI moved from Next.js 14 / React 18 to Next.js 15.5.29 / React 19.3.1, with react-leaflet 5 and React 19 types. Mobile stays on Expo's React 19.2.3. Route type generation is part of web typecheck so a fresh checkout does not require a prior build.
- Application Zod moved to 4.6.7. Mobile uses the compatible @hookform/resolvers 5.2.2. Existing validation, form and password-policy behavior is verified by the suites; no validation is bypassed to silence an advisory.
- Bounded pnpm overrides apply patched releases within the same major lines for proxy-addr, shell-quote, undici, node-forge, joi, engine.io, multer, body-parser, compression, lodash, source-map-js, postcss, xmldom, js-yaml, brace-expansion and fast-uri. Exact selectors/releases are in the root package manifest and frozen lockfile.
- Prisma config's deepmerge-ts is explicitly overridden to 8.0.2. This crosses a major boundary: upstream documents changes to Map merging and merge-into behavior. Prisma client generation and configuration loading passed locally; container startup, migrations and database-backed tests are required before deployment. [Upstream release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).

## URI decoder backport

Expo Router's query-string 7 requires a CommonJS decoder with legacy `+` handling. Blindly substituting the ESM-only 0.5.1 package changes that contract. The MIT-licensed upstream 0.5.1 linear decoder was backported into 0.2.2, retaining CommonJS and plus-to-space handling. The original package license remains in the installed package. The patch is committed under `patches/` and its hash is bound by `pnpm-lock.yaml`. [Upstream fix](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.1).

`scripts/uri-decoder.spec.mjs` resolves the actual Expo Router dependency. It checks CommonJS/query parsing, normal Unicode and malformed UTF-8, and processes a large malformed run in a child with a three-second kill limit. All 25 script tests passed locally. CI runs these tests and rejects new critical production advisories. The API Docker dependency stage copies patches so frozen installs remain reproducible.

## Remaining scanner output

The latest local `pnpm audit --prod` reports **0 critical, 1 high, 13 moderate and 2 low** across the complete workspace graph. The single high is GHSA-qr28-fpjm-wq7f on decode-uri-component 0.2.2: the scanner sees the package version rather than the committed backport. It is explicitly recorded here rather than hidden through an audit-ignore rule. Tests and the patch are its remediation evidence; upstream dependency alignment should eventually remove the backport.

Moderate/low findings remain for classification and further remediation. This document does not declare the entire dependency graph vulnerability-free, nor does a green CI certify clinical or legal readiness. Re-run the audit at release time because the advisory database changes.

## Other privacy changes in this release

Consent checking binds to current wording, hash, language and exact scope. Acceptance includes the displayed document id/hash; stale wording cannot silently accept a replacement. An external document requires its actual content digest, not a hash of its URL. Existing consent posture is preserved across deployments.

Push notifications carry generic text and an authenticated-inbox link, without clinical body or arbitrary metadata. HTTP logs use an allowlist that strips query strings, headers and bodies, with an actual HTTP logging regression test. Audit IPs use configured Express proxy trust. Tenant administrators no longer have access to the unscoped global user directory/lookups.
