import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';

import { SEEDED, createTestApp, tokenFor } from './utils/e2e';

/**
 * Every HTTP client in this repository — mobile, hospital-web,
 * blood-center-web, admin-web — ends its request helper with
 * `return json.data as T`. `docs/api.md` and `README.md` document the same
 * `{ data, meta }` envelope. But the envelope was never applied globally: some
 * services hand-wrote `return { data: ... }`, `AdminController` used
 * `WrapResponseInterceptor`, and seven whole controllers did neither.
 *
 * Those seven — notifications, laboratory, gamification (including the
 * leaderboard), community, campaigns, challenges and education — returned bare
 * payloads, so every client call against them evaluated to `undefined`. On
 * mobile that is silent rather than loud: `content?.items.map(...)` on
 * `undefined` renders nothing and `stats && <Card/>` renders nothing, so the
 * screens looked like empty states instead of failures. That is most of the
 * donor-facing surface of the app.
 *
 * This test walks the application's own OpenAPI document rather than a
 * hand-written list, so a new controller that forgets the envelope fails here
 * the day it is added.
 */
describe('every GET route returns the { data } envelope its clients unwrap', () => {
  let app: INestApplication;
  let adminToken: string;
  let paths: string[];

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await tokenFor(app, SEEDED.superAdmin);

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );

    // Parameterless GETs only: anything with a path parameter needs a fixture
    // per route, and the envelope is a controller-level concern, so one route
    // per controller is enough to catch a missing interceptor.
    paths = Object.entries(document.paths)
      .filter(([path, ops]) => 'get' in (ops as object) && !path.includes('{'))
      .map(([path]) => path)
      .sort();
  });

  afterAll(async () => {
    await app.close();
  });

  it('discovers a realistic number of routes to check', () => {
    expect(paths.length).toBeGreaterThan(50);
  });

  it('returns an enveloped body from every reachable route', async () => {
    const bare: string[] = [];

    for (const path of paths) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${adminToken}`);

      // 4xx is fine here — a route this actor cannot reach, or one needing
      // query parameters, still tells us nothing about the envelope. Only
      // successful responses are evidence.
      if (res.status >= 400) continue;

      const body = res.body as Record<string, unknown> | null;
      if (!body || typeof body !== 'object' || !('data' in body)) {
        bare.push(`${path} -> ${JSON.stringify(body).slice(0, 80)}`);
      }
    }

    expect(bare).toEqual([]);
  });
});
