import { RoleCode } from '@prisma/client';
import { EmergencyGateway } from './emergency.gateway';
import { socketFixture } from './socket.test-helper';

describe('EmergencyGateway live recipient authorization', () => {
  let f: ReturnType<typeof socketFixture>;
  let gateway: EmergencyGateway;
  beforeEach(() => {
    f = socketFixture();
    gateway = new EmergencyGateway(f.jwtService, f.prisma);
    f.db.emergencyRequest.findUnique.mockResolvedValue({
      hospitalId: 'hospital-1',
      responses: [{ donorId: 'donor-a' }, { donorId: 'donor-b' }],
    });
    f.db.organizationMembership.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(where.userId === 'staff' ? { id: 'membership' } : null),
    );
  });
  afterEach(() => gateway.onModuleDestroy());
  async function join(id: string, roles: RoleCode[]) {
    const client = f.client(id, roles);
    await gateway.handleConnection(client);
    await gateway.handleJoin(client, { emergencyRequestId: 'em-1' });
    return client;
  }
  const position = {
    responseId: 'r-1',
    donorId: 'donor-a',
    latitude: 41.3,
    longitude: 69.2,
    recordedAt: '2026-11-06T00:00:00Z',
  };

  it('sends location only to authorized hospital staff and own status only to the responding donor', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    const a = await join('donor-a', [RoleCode.DONOR]);
    const b = await join('donor-b', [RoleCode.DONOR]);
    await gateway.emitDonorLocationUpdate('em-1', position);
    expect(staff.emit).toHaveBeenCalledWith('donor_location', expect.objectContaining(position));
    expect(a.emit).not.toHaveBeenCalledWith('donor_location', expect.anything());
    expect(b.emit).not.toHaveBeenCalledWith('donor_location', expect.anything());
    await gateway.emitResponseStatusChanged('em-1', {
      responseId: 'r-1',
      donorId: 'donor-a',
      status: 'ACCEPTED',
    });
    expect(a.emit).toHaveBeenCalledWith('response_status_changed', expect.anything());
    expect(b.emit).not.toHaveBeenCalledWith('response_status_changed', expect.anything());
  });
  it('refuses strangers and requires an active hospital staff grant, not just any membership', async () => {
    const stranger = await join('stranger', [RoleCode.DONOR]);
    expect(stranger.join).not.toHaveBeenCalled();
    expect(f.db.organizationMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
          role: { code: { in: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] } },
        }),
      }),
    );
  });
  it('does not send to a revoked session which was already in the hospital room', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    f.records.get('staff')!.revokedAt = new Date();
    await gateway.emitDonorLocationUpdate('em-1', position);
    expect(staff.emit).not.toHaveBeenCalledWith('donor_location', expect.anything());
    expect(staff.disconnect).toHaveBeenCalledWith(true);
    expect(gateway.getConnectionState()).toEqual({ totalConnections: 0, rooms: [] });
  });
  it('checks room entitlement again when hospital membership is removed', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    f.db.organizationMembership.findFirst.mockResolvedValue(null);
    await gateway.emitDonorLocationUpdate('em-1', position);
    expect(staff.emit).not.toHaveBeenCalledWith('donor_location', expect.anything());
    expect(staff.disconnect).toHaveBeenCalled();
  });
  it('removes former platform admin authority without trusting the original token', async () => {
    const admin = await join('admin', [RoleCode.SUPER_ADMIN]);
    f.records.get('admin')!.user.memberships = [];
    await gateway.emitDonorLocationUpdate('em-1', position);
    expect(admin.emit).not.toHaveBeenCalledWith('donor_location', expect.anything());
  });
  it('suppresses broadcasts when the authorization database fails', async () => {
    const staff = await join('staff', [RoleCode.HOSPITAL_STAFF]);
    f.db.session.findUnique.mockRejectedValue(new Error('private database diagnostic'));
    await gateway.emitDonorLocationUpdate('em-1', position);
    expect(staff.emit).not.toHaveBeenCalledWith('donor_location', expect.anything());
    expect(staff.emit).toHaveBeenCalledWith('error', {
      message: 'Authentication or access expired',
    });
  });
});
