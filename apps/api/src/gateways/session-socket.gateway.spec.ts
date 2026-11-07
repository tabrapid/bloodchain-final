import { RoleCode } from '@prisma/client';
import { EmergencyGateway } from './emergency.gateway';
import { socketFixture } from './socket.test-helper';

describe('socket lifecycle authorization', () => {
  let f: ReturnType<typeof socketFixture>;
  let gateway: EmergencyGateway;
  beforeEach(() => {
    f = socketFixture();
    gateway = new EmergencyGateway(f.jwtService, f.prisma);
  });
  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
  });
  it.each(['revoked', 'expired', 'suspended', 'legacy', 'bad-signature'])(
    'rejects %s handshakes',
    async (kind) => {
      const client = f.client('u');
      const record = f.records.get('u')!;
      if (kind === 'revoked') record.revokedAt = new Date();
      if (kind === 'expired') record.expiresAt = new Date(0);
      if (kind === 'suspended') record.user.status = 'SUSPENDED';
      if (kind === 'legacy') f.jwt.verify.mockReturnValue({ sub: 'u', sid: '' });
      if (kind === 'bad-signature')
        f.jwt.verify.mockImplementation(() => {
          throw new Error('private token detail');
        });
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.emit).not.toHaveBeenCalledWith('connected', expect.anything());
      expect(gateway.getConnectionState().totalConnections).toBe(0);
    },
  );
  it('rejects incoming ping immediately after revocation', async () => {
    const client = f.client('u');
    await gateway.handleConnection(client);
    f.records.get('u')!.revokedAt = new Date();
    expect(await gateway.handlePing(client)).toEqual({
      success: false,
      error: 'Not authenticated',
    });
    expect(client.disconnect).toHaveBeenCalled();
  });
  it('checks quiet connections every 30 seconds and clears the interval on shutdown', async () => {
    jest.useFakeTimers();
    gateway.afterInit();
    const client = f.client('u', [RoleCode.DONOR]);
    await gateway.handleConnection(client);
    f.records.get('u')!.revokedAt = new Date();
    await jest.advanceTimersByTimeAsync(30_000);
    expect(client.disconnect).toHaveBeenCalled();
    gateway.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('does not register a handshake that disconnected during authorization', async () => {
    const client = f.client('u');
    let release!: (value: unknown) => void;
    f.db.session.findUnique.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }) as never,
    );
    const connection = gateway.handleConnection(client);
    gateway.handleDisconnect(client);
    release(f.records.get('u'));
    await connection;
    expect(client.emit).not.toHaveBeenCalledWith('connected', expect.anything());
    expect(gateway.getConnectionState().totalConnections).toBe(0);
  });
});
