import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * `migrations.seed` is what makes `prisma db seed` and `prisma migrate reset`
 * actually run the seed. Without it both commands succeed while doing nothing,
 * which is worse than failing: a reset leaves an empty database and reports
 * success. The seed lives in prisma/seed.ts and is also reachable as
 * `pnpm prisma:seed`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
