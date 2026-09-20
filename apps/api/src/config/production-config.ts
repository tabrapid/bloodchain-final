/**
 * What this API refuses to start with, when it believes it is in production.
 *
 * The codebase already fails closed in three places, each for the same reason
 * and each in isolation: `SmsService` refuses a development SMS adapter in
 * production, `checkLocalDatabase` refuses to TRUNCATE a database it cannot
 * identify as disposable, and `ClinicalReleaseService` refuses to release a
 * blood unit without an approved policy. Each of those guards one door.
 *
 * This guards the building. It is a single list of the configuration states
 * that must never be true in production, checked once, before anything is
 * constructed — so a deployment that is wrong is a refusal at boot with a list
 * of what to fix, rather than an API that starts, appears healthy, and is
 * quietly issuing one-time codes into a log file.
 *
 * Two design choices worth stating:
 *
 * 1. **It reads the raw environment, not the validated config.** Joi gives
 *    `SMS_PROVIDER` a default of `console`, so by the time `ConfigService` sees
 *    it, "nobody set this" and "somebody chose the development adapter" are the
 *    same value. Reading `process.env` keeps them apart, and "SMS_PROVIDER is
 *    not set" is a more useful thing to be told than "SMS_PROVIDER is console".
 *
 * 2. **It is a pure function over a plain object.** Same reason
 *    `checkLocalDatabase` is: a guard that can only be tested by booting an
 *    application in production mode is a guard nobody tests exhaustively.
 *
 * This file contains no clinical, laboratory, legal or operational policy and
 * must never acquire any. Every rule here is about deployment configuration.
 */

export interface ProductionConfigViolation {
  /** Machine-readable, stable, and what the tests assert on. */
  code: string;
  /** The variable at fault, for the operator scanning a boot log. */
  variable: string;
  /** What is wrong, in the operator's terms. */
  message: string;
  /** What to do about it. */
  remedy: string;
}

/** The exact placeholders `.env.example` ships. Copying the file is the likely path. */
const PLACEHOLDER_SECRET_MARKERS = ['replace-with-', 'changeme', 'change-me', 'your-secret', 'example'];

/**
 * Development-only markers a secret must not contain in production.
 *
 * Separate from the placeholder list because these come from somewhere else:
 * a CI job, a compose file, a developer's `.env` that made it into an image.
 */
const NON_PRODUCTION_SECRET_MARKERS = ['ci-only', 'development', 'dev-', 'test-', 'localhost', 'donor.local'];

function secretLooksNonProduction(value: string): string | null {
  const lowered = value.toLowerCase();
  for (const marker of PLACEHOLDER_SECRET_MARKERS) {
    if (lowered.includes(marker)) return `it still contains the placeholder text "${marker}"`;
  }
  for (const marker of NON_PRODUCTION_SECRET_MARKERS) {
    if (lowered.includes(marker)) return `it contains "${marker}", which marks it as a non-production value`;
  }
  return null;
}

/** SMS adapters that print rather than deliver. Kept in step with the provider registry. */
const DEVELOPMENT_SMS_PROVIDERS = new Set(['console', 'noop', 'mock', 'fake', 'stub']);

export interface ProductionConfigInput {
  NODE_ENV?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  OTP_HASH_SECRET?: string;
  PHONE_TICKET_SECRET?: string;
  SMS_PROVIDER?: string;
  SMS_DEV_LOG_FILE?: string;
  SMTP_HOST?: string;
  SMTP_FROM?: string;
  DEMO_ALLOW_DATABASE?: string;
  AI_ENABLED?: string;
  AI_API_KEY?: string;
  WEB_URL?: string;
  API_URL?: string;
}

/** Whether this process believes it is production. The one place that decides. */
export function isProductionEnvironment(env: ProductionConfigInput): boolean {
  return (env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

/**
 * Every configuration violation, or an empty list.
 *
 * Returns all of them rather than throwing on the first: an operator fixing a
 * deployment should get the whole list in one boot, not discover them one
 * restart at a time.
 */
export function checkProductionConfig(env: ProductionConfigInput): ProductionConfigViolation[] {
  if (!isProductionEnvironment(env)) return [];

  const violations: ProductionConfigViolation[] = [];

  // --- secrets ------------------------------------------------------------
  //
  // Length is already enforced by the Joi schema. What it cannot see is that a
  // 52-character string is the placeholder from `.env.example`, which is
  // exactly as long as a real secret and published in the repository.
  const secrets: [keyof ProductionConfigInput, string, boolean][] = [
    ['JWT_ACCESS_SECRET', 'Access tokens are signed with this.', true],
    ['JWT_REFRESH_SECRET', 'Refresh tokens are signed with this.', true],
    ['OTP_HASH_SECRET', 'One-time codes are stored hashed under this key.', false],
    ['PHONE_TICKET_SECRET', 'The proof-of-phone-ownership ticket is signed with this.', false],
  ];

  for (const [name, why, required] of secrets) {
    const value = (env[name] ?? '').trim();

    if (!value) {
      // The two optional ones legitimately fall back to JWT_REFRESH_SECRET,
      // which is itself checked above — so an empty value is only a violation
      // for the two that have no fallback.
      if (required) {
        violations.push({
          code: 'SECRET_MISSING',
          variable: name,
          message: `${name} is not set. ${why}`,
          remedy: `Generate a random value of at least 32 characters and set ${name}.`,
        });
      }
      continue;
    }

    const reason = secretLooksNonProduction(value);
    if (reason) {
      violations.push({
        code: 'SECRET_NOT_PRODUCTION',
        variable: name,
        message: `${name} is not a production secret: ${reason}. ${why}`,
        remedy: `Generate a fresh random value of at least 32 characters and set ${name}. Anything derived from a file in this repository is already public.`,
      });
    }
  }

  // --- SMS ----------------------------------------------------------------
  //
  // `SmsService` already refuses a development adapter at boot. This is the
  // second, independent barrier, and it fires earlier and says more: unset and
  // explicitly-console are different mistakes with the same consequence, and an
  // operator deserves to be told which one they made.
  const smsProvider = (env.SMS_PROVIDER ?? '').trim().toLowerCase();
  if (!smsProvider) {
    violations.push({
      code: 'SMS_PROVIDER_NOT_SET',
      variable: 'SMS_PROVIDER',
      message:
        'SMS_PROVIDER is not set, so it would fall back to the development adapter, which prints one-time codes instead of sending them.',
      remedy:
        'Set SMS_PROVIDER to a configured production adapter. See docs/sms-provider-integration.md for what an adapter needs.',
    });
  } else if (DEVELOPMENT_SMS_PROVIDERS.has(smsProvider)) {
    violations.push({
      code: 'SMS_PROVIDER_DEVELOPMENT',
      variable: 'SMS_PROVIDER',
      message: `SMS_PROVIDER is "${smsProvider}", which prints one-time codes rather than delivering them. A code in a log is an authentication bypass, not a degraded mode.`,
      remedy: 'Set SMS_PROVIDER to a configured production adapter.',
    });
  }

  // The development console adapter appends every message, including the code
  // itself, to this file as JSON. In production it is a file full of live
  // credentials.
  if ((env.SMS_DEV_LOG_FILE ?? '').trim()) {
    violations.push({
      code: 'SMS_DEV_LOG_FILE_SET',
      variable: 'SMS_DEV_LOG_FILE',
      message:
        'SMS_DEV_LOG_FILE is set. It writes every message, including one-time codes, to a file in plain text.',
      remedy: 'Unset SMS_DEV_LOG_FILE. It exists so a local verification script can read codes back.',
    });
  }

  // --- email --------------------------------------------------------------
  //
  // Without SMTP_HOST, EmailService falls back to a stream transport: nothing
  // is delivered and the whole message is written to the log. For a password
  // reset that message contains the reset link, so the failure mode is both
  // "account recovery is silently broken" and "recovery tokens are in the
  // logs" at the same time.
  if (!(env.SMTP_HOST ?? '').trim()) {
    violations.push({
      code: 'SMTP_NOT_CONFIGURED',
      variable: 'SMTP_HOST',
      message:
        'SMTP_HOST is not set. Outgoing email would be written to the log instead of delivered — including password-reset links — and account recovery would silently fail.',
      remedy: 'Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM.',
    });
  }

  // The quieter half of the same problem.
  //
  // `SMTP_FROM` has a default -- `BloodChain <no-reply@donor.local>` -- so
  // configuring a real provider and forgetting this one variable is a
  // deployment that *looks* correct: SMTP_HOST is set, the transport connects,
  // nothing warns. Every message is then sent from a domain nobody owns, and a
  // provider either refuses it outright or it fails SPF at the recipient and
  // lands in spam. Account recovery breaks again, for a different reason, and
  // this time with a working mail server to point at.
  const from = (env.SMTP_FROM ?? '').trim();
  if (/donor\.local|localhost|example\.(com|org|net)/i.test(from)) {
    violations.push({
      code: 'SMTP_FROM_NOT_DELIVERABLE',
      variable: 'SMTP_FROM',
      message: `SMTP_FROM is "${from}", which is not a domain this deployment owns. Mail sent from it is refused by the provider or fails SPF at the recipient.`,
      remedy:
        'Set SMTP_FROM to a mailbox on the real sending domain, and publish SPF, DKIM and DMARC for it.',
    });
  }

  // --- demo escape hatches -------------------------------------------------
  //
  // DEMO_ALLOW_DATABASE exists to let a developer say "yes, this oddly-named
  // local database really is disposable". Its presence in a production
  // environment means somebody copied a developer's file.
  if ((env.DEMO_ALLOW_DATABASE ?? '').trim()) {
    violations.push({
      code: 'DEMO_ESCAPE_HATCH_SET',
      variable: 'DEMO_ALLOW_DATABASE',
      message:
        'DEMO_ALLOW_DATABASE is set. It exists only to let a developer confirm that an oddly-named local database is disposable, and it names databases the demo seed is allowed to TRUNCATE.',
      remedy: 'Unset DEMO_ALLOW_DATABASE. It has no legitimate production use.',
    });
  }

  // --- AI ------------------------------------------------------------------
  //
  // Enabled without a key is not a degraded feature; it is a feature that
  // reports failures to donors from a health screen.
  if ((env.AI_ENABLED ?? '').trim().toLowerCase() === 'true' && !(env.AI_API_KEY ?? '').trim()) {
    violations.push({
      code: 'AI_ENABLED_WITHOUT_KEY',
      variable: 'AI_API_KEY',
      message: 'AI_ENABLED is true but AI_API_KEY is empty, so every AI request would fail.',
      remedy: 'Set AI_API_KEY, or set AI_ENABLED=false.',
    });
  }

  // --- public URLs ---------------------------------------------------------
  //
  // WEB_URL is the CORS allow-list and the base of every link mailed to a user.
  // A localhost entry in production is either a console nobody can reach or a
  // password-reset link pointing at the recipient's own machine.
  const localhostUrls = (env.WEB_URL ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(url));

  if (localhostUrls.length > 0) {
    violations.push({
      code: 'WEB_URL_LOCALHOST',
      variable: 'WEB_URL',
      message: `WEB_URL contains ${localhostUrls.join(', ')}. It is the CORS allow-list and the base of every link emailed to a user.`,
      remedy: 'Set WEB_URL to the real console origins.',
    });
  }

  if (/^http:\/\//i.test((env.API_URL ?? '').trim())) {
    violations.push({
      code: 'API_URL_NOT_HTTPS',
      variable: 'API_URL',
      message: 'API_URL is plain HTTP. Access tokens and donor health data would cross the network in clear text.',
      remedy: 'Terminate TLS and set API_URL to its https:// address.',
    });
  }

  return violations;
}

/** The boot-log message for a set of violations. */
export function formatProductionConfigViolations(violations: ProductionConfigViolation[]): string {
  const lines = [
    '',
    'BloodChain refuses to start: this deployment says NODE_ENV=production and its',
    `configuration is not safe for production. ${violations.length} problem(s):`,
    '',
  ];

  violations.forEach((violation, index) => {
    lines.push(`  ${index + 1}. [${violation.code}] ${violation.variable}`);
    lines.push(`     ${violation.message}`);
    lines.push(`     → ${violation.remedy}`);
    lines.push('');
  });

  lines.push('Nothing here is a warning. Each of these is a way real donor data, a');
  lines.push('one-time code, or a password-reset link reaches somewhere it should not.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Refuse to continue when production configuration is unsafe.
 *
 * Called from `main.ts` before the Nest application is created, so nothing —
 * no module, no cron, no listener — is constructed against a bad configuration.
 */
export function assertProductionConfig(env: ProductionConfigInput = process.env): void {
  const violations = checkProductionConfig(env);
  if (violations.length === 0) return;

  throw new Error(formatProductionConfigViolations(violations));
}
