import { serializeHttpRequest, serializeHttpResponse } from './http-log-serializers';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';

describe('HTTP log privacy allowlist', () => {
  it('omits verification tokens, cookies, request bodies and headers', () => {
    const request = {
      id: 'request-id', method: 'GET', url: '/api/v1/auth/verify-email-link?token=secret-token&email=private@example.com',
      headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
      body: { diagnosis: 'private-health-data', password: 'secret' },
    };
    expect(serializeHttpRequest(request)).toEqual({ id: 'request-id', method: 'GET', url: '/api/v1/auth/verify-email-link' });
  });

  it('keeps response bodies and Set-Cookie out of the response log', () => {
    const response = { statusCode: 200, headers: { 'set-cookie': 'session=secret' }, body: { accessToken: 'secret' } };
    expect(serializeHttpResponse(response)).toEqual({ statusCode: 200 });
  });

  it('omits sensitive values from an actual pino HTTP completion log', async () => {
    const records: string[] = [];
    const stream = new Writable({ write(chunk, _encoding, done) { records.push(String(chunk)); done(); } });
    const logger = pinoHttp({ serializers: { req: serializeHttpRequest, res: serializeHttpResponse } }, stream);
    const server = createServer((req, res) => {
      logger(req, res);
      res.setHeader('set-cookie', 'session=private-cookie');
      res.end('ok');
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/verify?token=private-token`, {
        headers: { authorization: 'Bearer private-authorization', cookie: 'private-cookie' },
      });
      await response.text();
      expect(records.length).toBeGreaterThan(0);
      const output = records.join('');
      for (const secret of ['private-token', 'private-cookie', 'private-authorization']) expect(output).not.toContain(secret);
      expect(JSON.parse(records[0]!).req.url).toBe('/verify');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
