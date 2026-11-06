import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('HTTP access token live authorization', () => {
  const db = { session: { findUnique: jest.fn() } };
  const strategy = new JwtStrategy(
    { getOrThrow: () => 'unit-test-access-secret' } as unknown as ConfigService,
    db as unknown as PrismaService,
  );
  const payload: JwtPayload = {
    sub: 'user-1', sid: 'session-1', roles: [RoleCode.SUPER_ADMIN], permissions: ['admin.manage'],
  };
  const membership = (code: RoleCode = RoleCode.DONOR, status = 'ACTIVE') => ({
    organization: { status },
    role: { code, permissions: [{ permission: { code: 'profile.read' } }] },
  });
  const session = () => ({
    userId: 'user-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    user: { status: 'ACTIVE', memberships: [membership()] },
  });
  beforeEach(() => db.session.findUnique.mockReset());

  it('uses current grants, never stale signed roles or permissions', async () => {
    db.session.findUnique.mockResolvedValue(session());
    expect(await strategy.validate(payload)).toEqual({
      sub: 'user-1', sid: 'session-1', roles: [RoleCode.DONOR], permissions: ['profile.read'],
    });
    expect(db.session.findUnique.mock.calls[0][0].include.user.include.memberships.where)
      .toEqual({ status: 'ACTIVE' });
  });
  it.each([undefined, '', 123])('rejects a missing/malformed session id: %s', async (sid) => {
    await expect(strategy.validate({ ...payload, sid } as JwtPayload)).rejects.toThrow(UnauthorizedException);
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });
  it.each([
    ['missing', null],
    ['revoked', { ...session(), revokedAt: new Date() }],
    ['expired', { ...session(), expiresAt: new Date(0) }],
    ['another owner', { ...session(), userId: 'other-user' }],
    ['suspended', { ...session(), user: { ...session().user, status: 'SUSPENDED' } }],
    ['deactivated', { ...session(), user: { ...session().user, status: 'DEACTIVATED' } }],
  ])('rejects %s sessions before entering controllers', async (_name, record) => {
    db.session.findUnique.mockResolvedValue(record);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
  it('removes suspended organization grants but preserves platform administration', async () => {
    const record = session();
    record.user.memberships = [membership(RoleCode.HOSPITAL_ADMIN, 'SUSPENDED'), membership(RoleCode.SUPER_ADMIN, 'SUSPENDED')];
    db.session.findUnique.mockResolvedValue(record);
    const user = await strategy.validate(payload);
    expect(user.roles).toEqual([RoleCode.SUPER_ADMIN]);
    expect(user.permissions).toContain('admin.manage');
  });
  it('does not cache a session across requests', async () => {
    db.session.findUnique.mockResolvedValueOnce(session()).mockResolvedValueOnce(null);
    await strategy.validate(payload);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
  it('fails closed when the authorization database is unavailable', async () => {
    db.session.findUnique.mockRejectedValue(new Error('database unavailable'));
    await expect(strategy.validate(payload)).rejects.toThrow('database unavailable');
  });
});
