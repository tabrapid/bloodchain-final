import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3001),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  REDIS_URL: Joi.string().uri().optional(),
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
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),
  SMTP_FROM: Joi.string().default('DONOR <no-reply@donor.local>'),
  EMAIL_VERIFICATION_TTL_HOURS: Joi.number().default(24),
  EXPO_ACCESS_TOKEN: Joi.string().optional(),
  DONATION_COOLDOWN_DAYS: Joi.number().min(1).default(56),
});
