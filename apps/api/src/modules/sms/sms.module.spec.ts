import { ConfigService } from '@nestjs/config';

import { createSmsProvider } from './sms.module';
import { knownSmsProviders, productionSmsProviders } from './providers/provider-registry';

/**
 * Which SMS adapter each environment is allowed to get.
 *
 * The failure this suite exists to prevent: an API that starts in production
 * with the console adapter and prints every one-time code to its log. That is
 * not a degraded mode — it is an authentication bypass available to anyone who
 * can read the log, which by then includes the log aggregator and its retention
 * period.
 *
 * There are two independent barriers against it: this factory, and
 * `SmsService.onModuleInit`. A third, `assertProductionConfig`, catches it
 * before the application is built at all. They are tested separately because
 * the point of having three is that no single one is load-bearing.
 */
function configOf(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('SMS provider selection', () => {
  describe('outside production', () => {
    it('gives the console adapter when asked for it', () => {
      const provider = createSmsProvider(configOf({ NODE_ENV: 'development', SMS_PROVIDER: 'console' }));

      expect(provider.name).toBe('console');
      expect(provider.isDevelopmentOnly).toBe(true);
    });

    it('defaults to the console adapter when nothing is configured', () => {
      // Local development must stay frictionless: cloning the repo and running
      // the API has to work without an SMS vendor.
      const provider = createSmsProvider(configOf({ NODE_ENV: 'development' }));

      expect(provider.name).toBe('console');
    });

    it.each(['test', 'development', undefined])('defaults for NODE_ENV=%s', (nodeEnv) => {
      expect(createSmsProvider(configOf({ NODE_ENV: nodeEnv })).name).toBe('console');
    });

    it('still refuses an unknown adapter, so a typo is never silent', () => {
      // A fallback here would mean a misspelled vendor name turns SMS delivery
      // off and leaves codes in a log — in development that wastes an
      // afternoon, and the same typo reaches production eventually.
      expect(() => createSmsProvider(configOf({ NODE_ENV: 'development', SMS_PROVIDER: 'eskizz' }))).toThrow(
        /Unknown SMS_PROVIDER "eskizz"/,
      );
    });

    it('lists the adapters it does know, in the error', () => {
      expect(() => createSmsProvider(configOf({ NODE_ENV: 'development', SMS_PROVIDER: 'nope' }))).toThrow(
        /Known adapters: console/,
      );
    });
  });

  describe('in production', () => {
    it('refuses the console adapter', () => {
      expect(() => createSmsProvider(configOf({ NODE_ENV: 'production', SMS_PROVIDER: 'console' }))).toThrow(
        /prints messages rather than delivering them/,
      );
    });

    it('refuses an unset provider, rather than defaulting to console', () => {
      // The case a single barrier handled worst. `SMS_PROVIDER` has a Joi
      // default of `console`, so by the time anything downstream reads it,
      // "nobody configured SMS" looks identical to "somebody chose the
      // development adapter".
      expect(() => createSmsProvider(configOf({ NODE_ENV: 'production' }))).toThrow(/SMS_PROVIDER is not set/);
    });

    it('refuses an empty provider string', () => {
      expect(() => createSmsProvider(configOf({ NODE_ENV: 'production', SMS_PROVIDER: '   ' }))).toThrow(
        /SMS_PROVIDER is not set/,
      );
    });

    it.each(['PRODUCTION', ' production '])('treats NODE_ENV=%s as production', (nodeEnv) => {
      expect(() => createSmsProvider(configOf({ NODE_ENV: nodeEnv, SMS_PROVIDER: 'console' }))).toThrow();
    });

    it('points at the integration document rather than just refusing', () => {
      expect(() => createSmsProvider(configOf({ NODE_ENV: 'production' }))).toThrow(
        /docs\/sms-provider-integration\.md/,
      );
    });
  });

  describe('the registry', () => {
    it('knows the console adapter', () => {
      expect(knownSmsProviders()).toContain('console');
    });

    it('ships no production adapter, and this test is the record of that', () => {
      // Deliberate, and MS-01's remaining external boundary. No vendor has been
      // contracted, and writing an adapter against a guessed API shape would
      // produce code that passes its own tests and fails on first contact with
      // the real endpoint — while making the blocker look closed.
      //
      // When a vendor is chosen, this expectation changes to name it. That is
      // the intended way to find out this file needs updating.
      expect(productionSmsProviders(configOf({}))).toEqual([]);
    });
  });
});
