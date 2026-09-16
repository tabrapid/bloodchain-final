# Boolean request fields are coerced, not parsed — **closed**

**Found:** Sprint 2, while verifying the organization directory over HTTP.
**Closed:** Sprint 2.1. Every boolean on every request DTO is now parsed
strictly, and a test stops the next one being written the old way.

Kept as a record rather than deleted: the failure mode is invisible in code
review, and the next person to reach for `@IsBoolean()` deserves to find this.

## What was happening

`apps/api/src/bootstrap.ts` configures the global `ValidationPipe` with
`transformOptions: { enableImplicitConversion: true }` (still does — see
"Why the pipe option stayed" below). Implicit conversion coerces every property
to its declared TypeScript type, and for a `boolean` that coercion is
`Boolean(value)`, under which **every non-empty string is `true`**:

| Client sends | Declared type | Value the service received |
| --- | --- | --- |
| `?verified=false` | `boolean` | `true` |
| `{"verified":"no"}` | `boolean` | `true` |
| `{"maintenanceMode":"off"}` | `boolean` | `true` |

`@IsBoolean()` did not catch it, because validation runs *after* the transform
and by then the value really is a boolean. The request succeeded, the response
looked plausible, and the filter or setting meant the opposite of what was
asked. Observed live: `GET /organizations?verified=false` returned the verified
organizations, byte-for-byte identical to `?verified=true`.

## The fix

`apps/api/src/common/decorators/strict-boolean.decorator.ts` exports
`OptionalBooleanField()` and `RequiredBooleanField()`. Both:

1. Read `obj[key]` — the value as the client sent it, *before* implicit
   conversion — rather than `value`, which has already been coerced.
2. Accept only `true` and `false`, as booleans or as those two words
   (trimmed, any letter case). Everything else is passed through untouched so
   `@IsBoolean()` refuses it with a 400 and the message key
   `validation.booleanStrict`.

`"1"`, `"0"`, `"yes"`, `"no"`, `"on"` and `"off"` are **rejected, not
interpreted**. Each is a convention some clients hold and others invert, and a
guess that lands the wrong way on `maintenanceMode` or `consentLocation` costs
more than a 400 does.

Applied to all 29 boolean fields on DTOs the pipe validates: the five platform
feature flags, donor `consentLocation`, the twelve notification and quiet-hours
toggles, push-device `isActive`, educational-content `isActive`, inventory
location `active`, leaderboard `visible`, and the eight organization-directory
booleans.

## What stops it coming back

`apps/api/src/common/boolean-input-strictness.spec.ts` walks every DTO a
controller reaches — directly, by inheritance, or nested through
`@Type(() => X)` — and fails, naming file, line and property, when a boolean
is validated with a bare `@IsBoolean()`. Neither TypeScript nor ESLint can see
the difference; this test can.

Behaviour is covered by `strict-boolean.decorator.spec.ts` (the decorator) and
`request-boolean-safety.spec.ts` (the real DTOs, through the real pipe), both
of which import the server's own `VALIDATION_PIPE_OPTIONS` so a test can never
validate under gentler settings than production runs.
`scripts/verify-boolean-safety.mjs` (`pnpm verify:booleans`) proves the same
over HTTP against a live API and database.

## Why the pipe option stayed

Turning `enableImplicitConversion` off would fix the class of bug at the root,
and is probably the right end state. It was not done here because it changes
every numeric and enum query parameter in the API at once: each would need an
explicit `@Type()`, and the ones that already have one would need checking
rather than assuming. That is a sprint of its own, with the full request-level
suite as its evidence. Until then the decorators carry the guarantee and the
guard keeps them applied.

## Related, and deliberately left alone

`AppointmentQueryDto.upcoming` / `.past` and the equivalent fields on the
donations query are declared as `string`, not `boolean`, and the service
compares them with `=== 'true'`. That is a different contract — an explicit
string comparison, not a coercion — so it was not converted. It does mean an
unrecognised value there is ignored rather than refused, which is worth
revisiting if those filters ever grow a third state.
