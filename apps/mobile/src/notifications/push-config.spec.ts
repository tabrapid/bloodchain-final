import { describePushConfig } from './push-config';

/**
 * Whether this build can receive a notification at all.
 *
 * The distinction matters because the two states look identical from inside a
 * `catch`: a developer with no Expo project and a store build with no Expo
 * project produce the same exception. One is normal and one means emergency
 * alerts will never arrive.
 */
describe('describePushConfig', () => {
  it('is configured when a project id reached the build', () => {
    expect(describePushConfig('abc-123', 'production')).toEqual({
      configured: true,
      projectId: 'abc-123',
    });
  });

  it('expects no project in a development build, so the app stays quiet', () => {
    const state = describePushConfig(undefined, 'development');
    expect(state).toMatchObject({ configured: false, expected: true });
  });

  it.each(['preview', 'production'])(
    'treats a missing project in a %s build as a problem worth showing',
    (environment) => {
      const state = describePushConfig(undefined, environment);
      expect(state).toMatchObject({ configured: false, expected: false });
      expect(state.configured === false && state.reason).toContain(
        'EXTERNAL_BLOCKER_EAS_PROJECT_ID',
      );
    },
  );

  it('says plainly that no notification can arrive, rather than that one failed', () => {
    const state = describePushConfig(undefined, 'production');
    expect(state.configured === false && state.reason).toMatch(/cannot receive push notifications/i);
  });
});
