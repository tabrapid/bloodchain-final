import { EskizSmsProvider } from './eskiz-sms.provider';

describe('Eskiz SMS contract and privacy', () => {
  const options = { email: 'test@example.invalid', password: 'test-secret', sender: 'test-sender' };
  const message = { to: '+998901234567', body: 'Synthetic OTP 123456', kind: 'otp' as const };
  const id = 'e837dec2-2f5a-44a9-a1d1-6fcc13e94d86';
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  let request: jest.Mock;
  let provider: EskizSmsProvider;

  beforeEach(() => {
    request = jest.fn();
    provider = new EskizSmsProvider(options, request as typeof fetch);
  });

  it('uses the documented multipart login and send fields, accepting only queue acknowledgement', async () => {
    request.mockResolvedValueOnce(json({ data: { token: 'test-token' } }))
      .mockResolvedValueOnce(json({ status: 'waiting', id }));
    expect(await provider.send(message)).toEqual({ accepted: true, providerMessageId: id });
    expect(request.mock.calls[0][0]).toBe('https://notify.eskiz.uz/api/auth/login');
    expect(request.mock.calls[0][1].body.get('email')).toBe(options.email);
    expect(request.mock.calls[0][1].body.get('password')).toBe(options.password);
    const [url, init] = request.mock.calls[1];
    expect(url).toBe('https://notify.eskiz.uz/api/message/sms/send');
    expect(init.body.get('mobile_phone')).toBe('998901234567');
    expect(init.body.get('message')).toBe(message.body);
    expect(init.body.get('from')).toBe(options.sender);
    expect(init.headers).toEqual({ Authorization: 'Bearer test-token' });
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('shares in-flight authentication for simultaneous requests', async () => {
    request.mockImplementation(async (url) => url.endsWith('/auth/login')
      ? json({ data: { token: 'test-token' } }) : json({ status: 'waiting', id }));
    const results = await Promise.all([provider.send(message), provider.send(message)]);
    expect(results.every((r) => r.accepted)).toBe(true);
    expect(request.mock.calls.filter(([url]) => url.endsWith('/auth/login'))).toHaveLength(1);
  });

  it('rejects unsupported numbers before any vendor request', async () => {
    expect(await provider.send({ ...message, to: '+12025550123' })).toEqual({ accepted: false, error: 'ESKIZ_INVALID_PHONE' });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects empty or oversized messages before any vendor request', async () => {
    for (const body of ['', ' '.repeat(2), 'x'.repeat(1601)]) {
      expect((await provider.send({ ...message, body })).accepted).toBe(false);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('never retries ambiguous send failures or exposes vendor response bodies', async () => {
    request.mockResolvedValueOnce(json({ data: { token: 'test-token' } }))
      .mockResolvedValueOnce(json({ secret: `${options.password} ${message.to} ${message.body}` }, 503));
    expect(await provider.send(message)).toEqual({ accepted: false, error: 'ESKIZ_HTTP_503' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('clears an expired token and authenticates on the next send, without resending the failed SMS', async () => {
    request.mockResolvedValueOnce(json({ data: { token: 'old-token' } }))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ data: { token: 'new-token' } }))
      .mockResolvedValueOnce(json({ status: 'waiting', id }));
    expect((await provider.send(message)).accepted).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
    expect((await provider.send(message)).accepted).toBe(true);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it.each([{ status: 'error', id }, { status: 'waiting' }, { status: 'waiting', id: 'not-a-receipt' }])(
    'refuses unexpected successful HTTP payloads: %j', async (payload) => {
      request.mockResolvedValueOnce(json({ data: { token: 'test-token' } })).mockResolvedValueOnce(json(payload));
      expect(await provider.send(message)).toEqual({ accepted: false, error: 'ESKIZ_UNEXPECTED_RESPONSE' });
    },
  );

  it('keeps thrown transport errors containing credentials out of the result', async () => {
    request.mockRejectedValue(new Error(`private ${options.password} ${message.body}`));
    expect(await provider.send(message)).toEqual({ accepted: false, error: 'ESKIZ_REQUEST_FAILED' });
  });

  it('refuses missing configuration without echoing other secret values', () => {
    expect(() => new EskizSmsProvider({ ...options, password: '' })).toThrow('SMS_API_SECRET');
  });
});
