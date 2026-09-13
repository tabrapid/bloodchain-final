import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizePhone } from './phone.util';

/**
 * The API's phone normalisation and the clients' must agree, exactly.
 *
 * They are two files because the API compiles with classic module resolution
 * and cannot import a workspace package -- the same constraint that forced the
 * password-policy parity spec in Sprint 0.6. Two copies of a rule is a bug
 * waiting to be written, so this is the thing that notices.
 *
 * It matters more here than it looks. If the client normalises `901234567` to
 * `+998901234567` and the server does not, a donor registers one number and
 * signs in with another; if the server is stricter, a number the app accepted
 * is refused at the last step of sign-up. Both failures look like "the app is
 * broken" and neither points at this file.
 *
 * Compared as behaviour rather than as text: the copies may differ in comments
 * and formatting, but not in what they do to a number.
 */
const CLIENT_COPY = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'validation',
  'src',
  'phone.ts',
);

/**
 * The client's implementation, loaded as source and evaluated.
 *
 * Importing it is what we cannot do; reading it is not a workaround so much as
 * the only way to test the claim at all. The file is plain TypeScript with no
 * imports, so stripping the type annotations leaves runnable JavaScript.
 */
function loadClientNormalize(): (input: string | null | undefined) => string | null {
  const source = readFileSync(CLIENT_COPY, 'utf8');

  const javascript = source
    .replace(/export function/g, 'function')
    .replace(/export (const|type)/g, '$1')
    .replace(/: string \| null \| undefined/g, '')
    .replace(/: string \| null/g, '')
    .replace(/: string/g, '')
    .replace(/: boolean/g, '')
    .replace(/\): [A-Za-z| ]+ \{/g, ') {');

  const factory = new Function(`${javascript}; return normalizePhone;`);
  return factory() as (input: string | null | undefined) => string | null;
}

describe('phone normalisation parity: the API and the clients agree', () => {
  const clientNormalize = loadClientNormalize();

  const inputs = [
    '+998901234567',
    '+998 90 123 45 67',
    '+998-90-123-45-67',
    '+998 (90) 123-45-67',
    '998901234567',
    '00998901234567',
    '901234567',
    '90 123 45 67',
    '8901234567',
    '8 90 123 45 67',
    '  +998901234567  ',
    '+1 415 555 0123',
    '+44 20 7946 0958',
    '',
    '   ',
    'abc',
    '+998',
    '+99890123',
    '+9989012345678',
    '+998012345678',
    '012345678',
    '12345',
    '+0123456789',
    '+998 90 123 45 6a',
    '998 90 123 45 67',
  ];

  it.each(inputs)('normalises %p identically on both sides', (input) => {
    expect(clientNormalize(input)).toBe(normalizePhone(input));
  });

  it('agrees that nothing is nothing', () => {
    expect(clientNormalize(null)).toBe(normalizePhone(null));
    expect(clientNormalize(undefined)).toBe(normalizePhone(undefined));
  });

  it('reads the client copy at all, so a moved file fails loudly', () => {
    expect(readFileSync(CLIENT_COPY, 'utf8')).toContain('export function normalizePhone');
  });
});
