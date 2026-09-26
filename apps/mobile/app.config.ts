import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The adapter, and nothing else.
 *
 * Expo resolves this file first and hands it `app.json` as `config`, so every
 * static value still lives there and this only layers the per-build ones on
 * top. The decision itself is in `src/config/app-config.ts`, because `src/` is
 * the tree jest runs and eslint checks -- keeping the logic out of here is what
 * makes the file that configures production testable at all.
 *
 * It is loaded with `require` and an explicit extension rather than `import`.
 * Expo transpiles this entry file and then evaluates it, so the nested load
 * goes to Node's own loader: Node 22 strips the types happily but will not
 * resolve an extensionless `.ts` specifier. The `typeof import(...)` cast keeps
 * TypeScript checking the call while the runtime specifier stays loadable.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildAppConfig } = require('./src/config/app-config.ts') as typeof import('./src/config/app-config');

type AppConfigBase = import('./src/config/app-config').AppConfigBase;

export default ({ config }: ConfigContext): ExpoConfig =>
  // Expo's own `Android` type has no index signature, so it is not structurally
  // assignable to the open shape the builder takes. The cast is at the boundary
  // and in one place, which is where a cast belongs.
  buildAppConfig(config as unknown as AppConfigBase, process.env) as unknown as ExpoConfig;
