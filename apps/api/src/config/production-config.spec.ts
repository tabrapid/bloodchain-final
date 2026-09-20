import { checkProductionConfig, assertProductionConfig, isProductionEnvironment } from './production-config';

/**
 * The configurations this API must refuse to start with.
 *
 * Every case here is a real deployment mistake, not a hypothetical: copying
 * `.env.example` and filling in only the database URL, carrying a developer's
 * `.env` into an image, deploying before the SMS vendor contract is signed,
 * leaving the mail catcher's settings in place. Each of them produces an API
 * that starts, answers `/health` with `status: ok`, and is quietly broken in a
 * way nobody notices until a donor cannot recover their account or a one-time
 * code turns up in a log aggregator.
 *
 * The guard is a pure function so these can be exhaustive without booting
 * anything — the same reason `checkLocalDatabase` is one.
 */

/** A configuration with nothing wrong with it. Each test breaks one thing. */
function validProductionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'H8x2Qm4vLp9Rt6Yw1Zn5Kc3Jb7Fd0Gs2Ae4Uh6Ij8Ok0Pl2Mn4',
    JWT_REFRESH_SECRET: 'Zq7Wr3Ty9Ui5Op1As8Df4Gh0Jk6Lz2Xc9Vb5Nm3Qw7Er1Ty5',
    OTP_HASH_SECRET: 'Bn5Mk8Ju3Hy6Gt9Fr2Ed7Wq4Za1Sx6Cd3Vf8Bg5Nh2Mj7Ki4',
    PHONE_TICKET_SECRET: 'Pl3Ok6Ij9Uh2Yg5Tf8Rd1Es4Wa7Qz0Xs3Cd6Vf9Bg2Nh5Mj8',
    SMS_PROVIDER: 'eskiz',
    SMTP_HOST: 'smtp.example.uz',
    WEB_URL: 'https://hospital.example.uz,https://centre.example.uz',
    API_URL: 'https://api.example.uz',
    ...overrides,
  };
}

const codes = (env: Record<string, string | undefined>) =>
  checkProductionConfig(env).map((violation) => violation.code);

describe('production configuration guard', () => {
  describe('when this is not production', () => {
    it('permits everything a developer needs', () => {
      // The whole local development configuration, which must stay frictionless.
      const violations = checkProductionConfig({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret-min-32-chars',
        JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret-min-32-chars',
        SMS_PROVIDER: 'console',
        SMS_DEV_LOG_FILE: '/tmp/sms.log',
        SMTP_HOST: '',
        DEMO_ALLOW_DATABASE: 'donor',
        WEB_URL: 'http://localhost:3000',
        API_URL: 'http://localhost:3001',
      });

      expect(violations).toEqual([]);
    });

    it.each(['test', 'development', 'dev', '', undefined])('permits NODE_ENV=%s', (nodeEnv) => {
      expect(checkProductionConfig({ NODE_ENV: nodeEnv, SMS_PROVIDER: 'console' })).toEqual([]);
    });

    it('does not treat a production-ish typo as production', () => {
      // The opposite failure would be worse than useless: refusing to boot a
      // staging environment because somebody wrote `prod`.
      expect(isProductionEnvironment({ NODE_ENV: 'prod' })).toBe(false);
      expect(isProductionEnvironment({ NODE_ENV: 'staging' })).toBe(false);
      expect(isProductionEnvironment({ NODE_ENV: 'PRODUCTION' })).toBe(true);
      expect(isProductionEnvironment({ NODE_ENV: ' production ' })).toBe(true);
    });
  });

  describe('secrets', () => {
    it('accepts a configuration with real secrets', () => {
      expect(checkProductionConfig(validProductionEnv())).toEqual([]);
    });

    it('refuses the placeholder secrets .env.example ships', () => {
      // These are the exact strings in the repository, so they are public.
      // They are also 52 characters long, which is why a minimum-length check
      // cannot catch them.
      const found = codes(
        validProductionEnv({
          JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret-min-32-chars',
          JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret-min-32-chars',
        }),
      );

      expect(found.filter((c) => c === 'SECRET_NOT_PRODUCTION')).toHaveLength(2);
    });

    it("refuses CI's throwaway secrets", () => {
      expect(codes(validProductionEnv({ JWT_ACCESS_SECRET: 'ci-only-access-secret-at-least-32-characters-long' }))).toContain(
        'SECRET_NOT_PRODUCTION',
      );
    });

    it('names the offending variable, so an operator does not have to guess', () => {
      const violations = checkProductionConfig(
        validProductionEnv({ JWT_REFRESH_SECRET: 'replace-with-a-long-random-refresh-secret-min-32-chars' }),
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]!.variable).toBe('JWT_REFRESH_SECRET');
      expect(violations[0]!.remedy).toMatch(/already public/);
    });

    it('refuses a missing signing secret', () => {
      expect(codes(validProductionEnv({ JWT_ACCESS_SECRET: '' }))).toContain('SECRET_MISSING');
    });

    it('permits the two optional secrets being unset, because they fall back to one that is checked', () => {
      // OTP_HASH_SECRET and PHONE_TICKET_SECRET fall back to
      // JWT_REFRESH_SECRET, which is itself required and checked. Demanding
      // them separately would be inventing a requirement.
      expect(checkProductionConfig(validProductionEnv({ OTP_HASH_SECRET: '', PHONE_TICKET_SECRET: '' }))).toEqual([]);
    });

    it('still checks the optional secrets when they ARE set', () => {
      expect(codes(validProductionEnv({ OTP_HASH_SECRET: 'dev-secret-that-is-long-enough-to-pass-joi-checks' }))).toContain(
        'SECRET_NOT_PRODUCTION',
      );
    });
  });

  describe('SMS', () => {
    it('refuses an unset provider, and says it is unset rather than that it is console', () => {
      const violations = checkProductionConfig(validProductionEnv({ SMS_PROVIDER: undefined }));

      expect(violations.map((v) => v.code)).toContain('SMS_PROVIDER_NOT_SET');
      expect(violations.find((v) => v.code === 'SMS_PROVIDER_NOT_SET')!.message).toMatch(/not set/);
    });

    it.each(['console', 'CONSOLE', ' console ', 'mock', 'noop', 'fake', 'stub'])(
      'refuses the development adapter "%s"',
      (provider) => {
        expect(codes(validProductionEnv({ SMS_PROVIDER: provider }))).toContain('SMS_PROVIDER_DEVELOPMENT');
      },
    );

    it('distinguishes "not set" from "set to console"', () => {
      // Different mistakes, different fixes, different messages. A single
      // barrier reading the defaulted config could not tell them apart.
      expect(codes(validProductionEnv({ SMS_PROVIDER: undefined }))).toEqual(['SMS_PROVIDER_NOT_SET']);
      expect(codes(validProductionEnv({ SMS_PROVIDER: 'console' }))).toEqual(['SMS_PROVIDER_DEVELOPMENT']);
    });

    it('refuses SMS_DEV_LOG_FILE, which writes one-time codes to disk in plain text', () => {
      expect(codes(validProductionEnv({ SMS_DEV_LOG_FILE: '/var/log/sms.jsonl' }))).toContain('SMS_DEV_LOG_FILE_SET');
    });
  });

  describe('email', () => {
    it('refuses an unconfigured SMTP host', () => {
      // The fallback logs the whole message. For a password reset that message
      // is a single-use link to somebody's account.
      const violations = checkProductionConfig(validProductionEnv({ SMTP_HOST: '' }));

      expect(violations.map((v) => v.code)).toContain('SMTP_NOT_CONFIGURED');
      expect(violations.find((v) => v.code === 'SMTP_NOT_CONFIGURED')!.message).toMatch(/password-reset/);
    });
  });

  describe('development escape hatches', () => {
    it('refuses DEMO_ALLOW_DATABASE, which names databases the demo seed may TRUNCATE', () => {
      expect(codes(validProductionEnv({ DEMO_ALLOW_DATABASE: 'bloodchain_prod' }))).toContain('DEMO_ESCAPE_HATCH_SET');
    });
  });

  describe('AI', () => {
    it('refuses the feature being enabled with no key behind it', () => {
      expect(codes(validProductionEnv({ AI_ENABLED: 'true', AI_API_KEY: '' }))).toContain('AI_ENABLED_WITHOUT_KEY');
    });

    it('permits the feature being off', () => {
      expect(checkProductionConfig(validProductionEnv({ AI_ENABLED: 'false', AI_API_KEY: '' }))).toEqual([]);
    });
  });

  describe('public URLs', () => {
    it('refuses a localhost console origin', () => {
      // WEB_URL is the CORS allow-list AND the base of every emailed link, so
      // localhost here means a reset link pointing at the recipient's laptop.
      expect(codes(validProductionEnv({ WEB_URL: 'https://real.example.uz,http://localhost:3000' }))).toContain(
        'WEB_URL_LOCALHOST',
      );
    });

    it('refuses a plain-HTTP API URL', () => {
      expect(codes(validProductionEnv({ API_URL: 'http://api.example.uz' }))).toContain('API_URL_NOT_HTTPS');
    });

    it('permits an HTTPS API URL', () => {
      expect(codes(validProductionEnv({ API_URL: 'https://api.example.uz' }))).not.toContain('API_URL_NOT_HTTPS');
    });
  });

  describe('reporting', () => {
    it('reports every violation at once, not the first', () => {
      // An operator fixing a deployment should get the whole list in one boot,
      // rather than discovering them one restart at a time.
      const violations = checkProductionConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'replace-with-a-long-random-access-secret-min-32-chars',
        JWT_REFRESH_SECRET: '',
        SMS_PROVIDER: 'console',
        SMS_DEV_LOG_FILE: '/tmp/sms.log',
        SMTP_HOST: '',
        DEMO_ALLOW_DATABASE: 'donor',
        WEB_URL: 'http://localhost:3000',
        API_URL: 'http://localhost:3001',
      });

      expect(violations.length).toBeGreaterThanOrEqual(7);
      expect(new Set(violations.map((v) => v.code)).size).toBeGreaterThanOrEqual(6);
    });

    it('throws with every violation in the message', () => {
      expect(() =>
        assertProductionConfig(validProductionEnv({ SMS_PROVIDER: 'console', SMTP_HOST: '' })),
      ).toThrow(/SMS_PROVIDER[\s\S]*SMTP_HOST|SMTP_HOST[\s\S]*SMS_PROVIDER/);
    });

    it('does not throw for a sound production configuration', () => {
      expect(() => assertProductionConfig(validProductionEnv())).not.toThrow();
    });

    it('does not throw outside production', () => {
      expect(() => assertProductionConfig({ NODE_ENV: 'development' })).not.toThrow();
    });
  });
});
