import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service';
import { SEEDED, createTestApp, seededOrganizations, tokenFor } from './utils/e2e';

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
 *
 * It used to walk only the parameterless GETs, on the reasoning that the
 * envelope is a controller-level concern and one route per controller is
 * enough. Sprint 2 disproved that: `GET /organizations` was enveloped and
 * `GET /organizations/:id` was not, in the same controller, and the directory
 * UI built on the second one rendered blank for a sprint. So the sweep now
 * substitutes real seeded ids into single-parameter routes too.
 */
describe('every GET route returns the { data } envelope its clients unwrap', () => {
  let app: INestApplication;
  let adminToken: string;
  let paths: string[];
  /** Resolves a real id for one path parameter, or nothing. */
  let idFor: (path: string, name: string) => string | undefined;
  let parameterised: string[];

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await tokenFor(app, SEEDED.superAdmin);

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );

    const gets = Object.entries(document.paths)
      .filter(([, ops]) => 'get' in (ops as object))
      .map(([path]) => path)
      .sort();

    paths = gets.filter((path) => !path.includes('{'));

    idFor = await resolveIds(app);

    // Single-parameter GETs whose parameter we can fill from seeded data.
    // Multi-parameter routes are left out: they need a matched pair (this
    // organization's shipment), which is a fixture per route rather than a
    // lookup, and the org-scoped controllers are already covered by their
    // parameterless siblings.
    parameterised = gets
      .filter((path) => (path.match(/\{/g) ?? []).length === 1)
      .map((path) => path.replace(/\{(\w+)\}/, (_match, name: string) => idFor(path, name) ?? ''))
      .filter((path) => !path.includes('//') && !path.endsWith('/'));
  });

  /**
   * Real ids to substitute into single-parameter GET routes.
   *
   * `{id}` means a different thing in every controller, so it is resolved by
   * the resource segment that precedes it rather than by the parameter name --
   * substituting an organization id into `/users/{id}` would produce a 404 that
   * the sweep would read as "nothing to say here" and skip. Distinctly named
   * parameters (`{laboratoryId}`) are resolved by name. A parameter with no
   * entry drops out of the sweep rather than being guessed.
   */
  async function resolveIds(application: INestApplication) {
    const db = application.get(PrismaService);
    const { hospital } = await seededOrganizations(application);

    const [user, laboratory, testType, campaign, challenge, content, post, donation, appointment] =
      await Promise.all([
        db.user.findFirst({ where: { email: SEEDED.donor } }),
        db.laboratoryProfile.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.testType.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.campaign.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.challenge.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.educationalContent.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.communityPost.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.donation.findFirst({ orderBy: { createdAt: 'asc' } }),
        db.appointment.findFirst({ orderBy: { createdAt: 'asc' } }),
      ]);

    /** `{id}` under `/api/v1/<resource>/{id}`. */
    const byResource: Record<string, string | undefined> = {
      organizations: hospital.id,
      users: user?.id,
      donations: donation?.id,
      appointments: appointment?.id,
      campaigns: campaign?.id,
      challenges: challenge?.id,
      education: content?.id,
    };

    /** Parameters whose name already says what they are. */
    const byName: Record<string, string | undefined> = {
      organizationId: hospital.id,
      laboratoryId: laboratory?.organizationId,
      testTypeId: testType?.id,
      contentId: content?.id,
      postId: post?.id,
      donationId: donation?.id,
      appointmentId: appointment?.id,
      campaignId: campaign?.id,
      challengeId: challenge?.id,
    };

    return (path: string, name: string): string | undefined =>
      name === 'id' ? byResource[path.split('/')[3] ?? ''] : byName[name];
  }

  it('discovers a realistic number of routes to check', () => {
    expect(paths.length).toBeGreaterThan(50);
    // A silently empty parameterised sweep is exactly how `/organizations/:id`
    // went unnoticed, so the count is asserted rather than assumed.
    expect(parameterised.length).toBeGreaterThan(5);
  });

  it('returns an enveloped body from every reachable route', async () => {
    const bare: string[] = [];

    for (const path of [...paths, ...parameterised]) {
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
