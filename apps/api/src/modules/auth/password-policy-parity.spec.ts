import { readFileSync } from 'fs';
import { join } from 'path';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';

/**
 * Sprint 0.6 guard: the server's password policy and the client's must agree.
 *
 * Four DTOs accept a new password, each carrying its own copy of the same five
 * rules, and the apps validate the same input with a zod schema in
 * @bloodchain/validation. Nothing links the two, so for a while they disagreed:
 * the shared schema checked length only, and a 12-character all-lowercase
 * password passed every form and was refused by the server -- the user learning
 * the real rule one rejection at a time.
 *
 * Agreement is checked two ways, because each catches what the other cannot.
 * The behavioural half runs real passwords through the DTOs and pins the
 * verdicts; the mirror of it, running the same fixtures through the zod schema,
 * lives in packages/validation's own spec. The source half then compares the
 * rules themselves, character class by character class, which catches a rule
 * added to one side that the fixtures happen not to exercise.
 *
 * The comparison reads @bloodchain/validation as text rather than importing it:
 * this package's tsconfig uses classic module resolution and cannot resolve the
 * workspace package's types. Reading the source is not a workaround here so
 * much as the point -- what must not drift is the declared rule.
 */

const NEW_PASSWORD_DTOS = [
  ['RegisterDto', RegisterDto, 'password'],
  ['ChangePasswordDto', ChangePasswordDto, 'newPassword'],
  ['ResetPasswordDto', ResetPasswordDto, 'newPassword'],
  ['RegisterOrganizationDto', RegisterOrganizationDto, 'adminPassword'],
] as const;

/** A complete, valid body for each DTO, so only the password is under test. */
const bodyFor = (dtoName: string, password: string): Record<string, unknown> => {
  switch (dtoName) {
    case 'RegisterDto':
      return { email: 'donor@example.com', password, firstName: 'Aziz', lastName: 'Karimov' };
    case 'ChangePasswordDto':
      return { currentPassword: 'whatever-is-stored', newPassword: password };
    case 'ResetPasswordDto':
      return { token: 'a'.repeat(64), newPassword: password };
    default:
      return {
        organizationType: 'HOSPITAL',
        organizationName: 'Jizzakh City Hospital',
        adminEmail: 'admin@example.com',
        adminPassword: password,
        adminFirstName: 'Aziz',
        adminLastName: 'Karimov',
      };
  }
};

async function passwordErrors(
  dtoName: string,
  dto: new () => object,
  field: string,
  password: string,
): Promise<string[]> {
  const instance = plainToInstance(dto, bodyFor(dtoName, password));
  const errors = await validate(instance as object);
  return errors.filter((error) => error.property === field).flatMap((e) => Object.values(e.constraints ?? {}));
}

/** The `.regex(...)` patterns `strongPasswordSchema` is built from. */
function sharedSchemaPatterns(): string[] {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', '..', '..', 'packages', 'validation', 'src', 'index.ts'),
    'utf8',
  );
  const declaration = source.match(
    /export const strongPasswordSchema = passwordSchema([\s\S]*?);\n/,
  )?.[1];
  if (!declaration) throw new Error('strongPasswordSchema not found in @bloodchain/validation');
  return (declaration.match(/\.regex\((\/[^,]*?\/)[,)]/g) ?? []).map((m) =>
    m.replace(/^\.regex\(/, '').replace(/[,)]$/, ''),
  );
}

describe('password policy: the API DTOs agree with each other', () => {
  const cases: Array<[string, string, boolean]> = [
    ['a compliant password', 'DevelopmentOnly!123', true],
    ['one character too short', 'Ab1!efghijk', false],
    ['no uppercase letter', 'developmentonly!123', false],
    ['no lowercase letter', 'DEVELOPMENTONLY!123', false],
    ['no number', 'DevelopmentOnly!abc', false],
    ['no special character', 'DevelopmentOnly1234', false],
    ['over the 128-character maximum', `Aa1!${'x'.repeat(126)}`, false],
  ];

  describe.each(cases)('%s', (_label, password, shouldPass) => {
    it.each(NEW_PASSWORD_DTOS.map(([name, dto, field]) => [name, dto, field] as const))(
      `is ${shouldPass ? 'accepted' : 'rejected'} by %s`,
      async (name, dto, field) => {
        const errors = await passwordErrors(name, dto as unknown as new () => object, field, password);
        expect(errors.length === 0).toBe(shouldPass);
      },
    );
  });
});

describe('password policy: no DTO has grown a rule the client does not know about', () => {
  const dtoDir = join(__dirname, 'dto');
  const files = [
    'register.dto.ts',
    'change-password.dto.ts',
    'reset-password.dto.ts',
    'register-organization.dto.ts',
  ];

  // The five rules every password field carries. Counted as source, because a
  // sixth added to one DTO would not necessarily be caught by the fixtures
  // above -- and this test is what tells the next person to update both sides.
  const EXPECTED_MATCHES = ['/[A-Z]/', '/[a-z]/', '/[0-9]/', '/[^A-Za-z0-9]/'];

  it.each(files)('%s carries exactly the four character-class rules', (file) => {
    const source = readFileSync(join(dtoDir, file), 'utf8');
    const matches = source.match(/@Matches\((\/[^)]*?\/)[,)]/g) ?? [];
    const patterns = matches.map((m) => m.replace(/@Matches\(/, '').replace(/[,)]$/, ''));

    expect(patterns.sort()).toEqual([...EXPECTED_MATCHES].sort());
  });

  it.each(files)('%s keeps the 12-character minimum', (file) => {
    const source = readFileSync(join(dtoDir, file), 'utf8');
    expect(source).toMatch(/@MinLength\(12/);
  });

  it('and the shared client schema declares exactly the same four', () => {
    expect(sharedSchemaPatterns().sort()).toEqual([...EXPECTED_MATCHES].sort());
  });
});
