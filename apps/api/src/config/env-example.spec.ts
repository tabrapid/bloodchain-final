import { readFileSync } from 'fs';
import { join } from 'path';

import { envValidationSchema } from './env.validation';

/**
 * P3-4 guard.
 *
 * `.env.example` is what the README tells a new developer to copy into `.env`
 * and `apps/api/.env`, and it is what `docker-compose.yml` mirrors. Nothing
 * checked that the file it hands them actually satisfies the schema the API
 * validates at boot — and it did not: `SMTP_HOST=""`, `SMTP_USER=""`,
 * `SMTP_PASSWORD=""` and `EXPO_ACCESS_TOKEN=""` were all declared
 * `Joi.string().optional()`, which rejects an empty string. Following the
 * documented setup produced an API that refused to start, with a config
 * validation error naming four variables the file itself tells you to leave
 * blank.
 *
 * These tests read the real file and the real schema, so they fail if either
 * side drifts from the other again.
 */
describe('P3-4: .env.example satisfies the API env schema', () => {
  const envExamplePath = join(__dirname, '..', '..', '..', '..', '.env.example');
  const raw = readFileSync(envExamplePath, 'utf8');

  function parse(source: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of source.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
      out[key] = value;
    }
    return out;
  }

  const example = parse(raw);

  it('parses into a non-trivial set of variables', () => {
    expect(Object.keys(example).length).toBeGreaterThan(15);
  });

  it('validates against the schema the API boots with', () => {
    // The two secrets are placeholders in the example file and only need to be
    // long enough; everything else is asserted exactly as shipped.
    const candidate = {
      ...example,
      JWT_ACCESS_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'b'.repeat(48),
    };

    const { error } = envValidationSchema.validate(candidate, {
      // Mirrors what ConfigModule uses: abortEarly from app.module.ts,
      // allowUnknown from @nestjs/config's own default.
      abortEarly: false,
      allowUnknown: true,
    });

    expect(error?.details.map((d) => d.message) ?? []).toEqual([]);
  });

  it('documents every variable the schema knows about', () => {
    const described = Object.keys(envValidationSchema.describe().keys);
    // DATABASE_URL aside, these are all things an operator may need to set.
    const missing = described.filter((key) => !(key in example));

    expect(missing).toEqual([]);
  });

  it('does not document variables nothing reads', () => {
    // MAP_API_KEY, FCM_SERVER_KEY and APNS_KEY_ID were listed here for
    // integrations that do not exist anywhere in the codebase, and
    // JWT_REFRESH_EXPIRES_IN for a lifetime that is actually a platform
    // setting. Documenting a knob that does nothing is worse than omitting it:
    // an operator sets it to meet a requirement and believes it took effect.
    const dead = ['MAP_API_KEY', 'FCM_SERVER_KEY', 'APNS_KEY_ID', 'JWT_REFRESH_EXPIRES_IN', 'REDIS_URL'];

    expect(dead.filter((key) => key in example)).toEqual([]);
  });
});
