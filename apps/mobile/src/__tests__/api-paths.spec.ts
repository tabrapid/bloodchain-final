import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = join(__dirname, '..', 'api');

/**
 * Every path this app sends to the server, as written in `src/api`.
 *
 * The request path and the server's prefix are two separate facts, and nothing
 * compared them: the API mounts every controller under `api/v1`
 * (`setGlobalPrefix` in the API's bootstrap), while seven modules -- campaigns,
 * challenges, community, courier, education, emergency and laboratory -- asked
 * for `/campaigns`, `/courier/profile` and so on. Fifty-eight calls, every one
 * of them a 404: the whole courier role, the emergency flow and the laboratory
 * screens could not have worked against a real server.
 *
 * Type-checking cannot catch this -- a wrong URL is a perfectly good string.
 */
function apiCallPaths(): { file: string; path: string }[] {
  const found: { file: string; path: string }[] = [];
  const pattern = /apiRequest(?:Envelope)?(?:<[^>]*>)?\(\s*(`[^`]*`|'[^']*')/gs;
  for (const file of readdirSync(API_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts') || file === 'config.ts') continue;
    const source = readFileSync(join(API_DIR, file), 'utf8');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      found.push({ file, path: match[1]!.slice(1, -1) });
    }
  }
  return found;
}

describe('every API path carries the server prefix', () => {
  it('finds the call sites at all', () => {
    expect(apiCallPaths().length).toBeGreaterThan(80);
  });

  it('prefixes every path with apiBasePath', () => {
    const unprefixed = apiCallPaths()
      .filter(({ path }) => !path.startsWith('${apiBasePath}') && !path.startsWith('/api/v1'))
      .map(({ file, path }) => `${file}: ${path}`);

    expect(unprefixed).toEqual([]);
  });

  /**
   * The token refresh builds its own URL, outside `apiRequest`, and was missed.
   * Assert the prefix rather than the whole expression: how the base address is
   * obtained is free to change (it is now resolved by probing), but the
   * `/api/v1` in front of the path is the thing this guards.
   */
  it('prefixes the token refresh, which builds its URL by hand', () => {
    const client = readFileSync(join(API_DIR, 'client.ts'), 'utf8');

    expect(client).toMatch(/\$\{apiBasePath\}\/auth\/refresh/);
  });
});
