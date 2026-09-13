import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  WEB_URL: Joi.string()
    .custom((value: string, helpers) => {
      const origins = value.split(',').map((origin) => origin.trim());
      const isValid = origins.every(
        (origin) => Joi.string().uri().validate(origin).error === undefined,
      );
      if (!isValid) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'comma-separated list of URIs')
    .default('http://localhost:3000'),
  // Where a password reset link should send each kind of account.
  //
  // `WEB_URL` is a list of allowed CORS origins, and its first entry used to be
  // the reset link for everybody -- so a blood centre user was mailed a link to
  // the hospital console. These name one origin each, are optional, and fall
  // back to the first WEB_URL entry when unset, which keeps single-origin
  // deployments working with no extra configuration.
  WEB_URL_HOSPITAL: Joi.string().uri().optional(),
  WEB_URL_BLOOD_CENTER: Joi.string().uri().optional(),
  WEB_URL_ADMIN: Joi.string().uri().optional(),
  API_URL: Joi.string().uri().default('http://localhost:3001'),
  MOBILE_DEEP_LINK: Joi.string().default('donor://'),
  THROTTLER_TTL: Joi.number().default(60),
  THROTTLER_LIMIT: Joi.number().default(100),
  AUTH_THROTTLE_LIMIT: Joi.number().default(5),
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().default('BloodChain <no-reply@donor.local>'),
  EMAIL_VERIFICATION_TTL_HOURS: Joi.number().default(24),
  // A reset token is account takeover in one string, so its life is measured
  // in minutes rather than the day an email-verification link gets.
  PASSWORD_RESET_TTL_MINUTES: Joi.number().min(5).max(1440).default(60),
  // Per-account floor between reset emails, on top of the per-IP throttle:
  // the throttle alone does not stop someone flooding one person's inbox.
  PASSWORD_RESET_COOLDOWN_SECONDS: Joi.number().min(0).default(60),
  // How long an emergency journey's location history is kept after the
  // response closes. The default is a development convenience, NOT a legal
  // retention decision -- see .env.example.
  EMERGENCY_LOCATION_RETENTION_HOURS: Joi.number().min(1).default(72),
  EXPO_ACCESS_TOKEN: Joi.string().allow('').optional(),
  DONATION_COOLDOWN_DAYS: Joi.number().min(1).default(56),

  // AI health insights. Every default here mirrors the fallback the reading
  // code already passes to ConfigService.get, so declaring them changes no
  // behaviour -- it just means a typo'd AI_MAX_TOKENS fails at boot instead of
  // silently reverting to 1000. AI_ENABLED is deliberately a *string*: the
  // feature gate compares it with `!== 'true'`, so a Joi.boolean() here would
  // coerce it and turn the feature permanently off.
  AI_ENABLED: Joi.string().valid('true', 'false').default('false'),
  AI_API_KEY: Joi.string().allow('').optional(),
  AI_MODEL: Joi.string().default('gpt-4o-mini'),
  AI_BASE_URL: Joi.string().uri().default('https://api.openai.com/v1'),
  AI_MAX_TOKENS: Joi.number().integer().min(1).default(1000),
  AI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
});
