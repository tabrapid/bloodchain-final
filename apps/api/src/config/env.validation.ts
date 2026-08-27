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
  API_URL: Joi.string().uri().default('http://localhost:3001'),
  MOBILE_DEEP_LINK: Joi.string().default('donor://'),
  THROTTLER_TTL: Joi.number().default(60),
  THROTTLER_LIMIT: Joi.number().default(100),
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().default('BloodChain <no-reply@donor.local>'),
  EMAIL_VERIFICATION_TTL_HOURS: Joi.number().default(24),
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
