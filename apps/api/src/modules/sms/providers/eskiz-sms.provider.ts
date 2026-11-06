import type { SmsDeliveryResult, SmsMessage, SmsProvider } from './sms-provider.interface';

const API = 'https://notify.eskiz.uz/api';

/** Eskiz's published multipart API. Queue acceptance is not handset delivery. */
export class EskizSmsProvider implements SmsProvider {
  readonly name = 'eskiz';
  readonly isDevelopmentOnly = false;
  private token?: string;
  private tokenExpiresAt = 0;
  private authentication?: Promise<string>;

  constructor(
    private readonly options: { email: string; password: string; sender: string },
    private readonly request: typeof fetch = fetch,
  ) {
    for (const [variable, value] of [
      ['SMS_API_USER', options.email], ['SMS_API_SECRET', options.password], ['SMS_SENDER_ID', options.sender],
    ]) {
      if (!value?.trim()) throw new Error(`${variable} must be configured for SMS_PROVIDER=eskiz.`);
    }
  }

  private async authenticate(): Promise<string> {
    const form = new FormData();
    form.set('email', this.options.email);
    form.set('password', this.options.password);
    const response = await this.request(`${API}/auth/login`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (!response.ok) throw new Error('ESKIZ_AUTH_FAILED');
    const payload = await response.json() as { data?: { token?: unknown } };
    if (typeof payload.data?.token !== 'string' || !payload.data.token) throw new Error('ESKIZ_AUTH_FAILED');
    this.token = payload.data.token;
    // Conservative local cache; provider expiry is also handled by clearing
    // on 401. No unverified JWT claims are used as authorization decisions.
    this.tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    return this.token;
  }

  private getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return Promise.resolve(this.token);
    if (!this.authentication) {
      this.authentication = this.authenticate().finally(() => { this.authentication = undefined; });
    }
    return this.authentication;
  }

  async send(message: SmsMessage): Promise<SmsDeliveryResult> {
    if (!/^\+998\d{9}$/.test(message.to)) return { accepted: false, error: 'ESKIZ_INVALID_PHONE' };
    if (!message.body.trim() || message.body.length > 1600) return { accepted: false, error: 'ESKIZ_INVALID_MESSAGE' };
    try {
      const token = await this.getToken();
      const form = new FormData();
      form.set('mobile_phone', message.to.slice(1));
      form.set('message', message.body);
      form.set('from', this.options.sender);
      const response = await this.request(`${API}/message/sms/send`, {
        method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (!response.ok) {
        if (response.status === 401 && this.token === token) {
          this.token = undefined;
          this.tokenExpiresAt = 0;
        }
        // Never retry an SMS automatically: a timeout/5xx may follow a send.
        return { accepted: false, error: `ESKIZ_HTTP_${response.status}` };
      }
      const payload = await response.json() as { id?: unknown; status?: unknown };
      if (payload.status !== 'waiting' || typeof payload.id !== 'string' ||
        !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(payload.id)) {
        return { accepted: false, error: 'ESKIZ_UNEXPECTED_RESPONSE' };
      }
      return { accepted: true, providerMessageId: payload.id };
    } catch {
      // Vendor errors can echo credentials, phone numbers and message bodies.
      // Only a stable code may reach SmsService's logs or the audit trail.
      return { accepted: false, error: 'ESKIZ_REQUEST_FAILED' };
    }
  }
}
