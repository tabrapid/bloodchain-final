import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';
import { ApiRequestError } from '../api/client';

/**
 * Sprint 1B: phone-first sign-up on the donor app.
 *
 * The things worth testing are the ones that are invisible when they work. The
 * number is normalised before it leaves the device, so `90 123 45 67` and
 * `+998 90 123 45 67` are one account rather than two. The resend button is
 * only offered once it will actually work, because a control that looks
 * available and answers 429 teaches a donor that the app is broken. And the
 * proof of ownership the server signs is carried through to registration
 * untouched -- the client never gets to say which number was verified.
 */

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
  useLocalSearchParams: () => mockRouteParams,
}));

const mockRequestPhoneCode = jest.fn();
const mockVerifyPhoneCode = jest.fn();
const mockRegisterWithPhone = jest.fn();
const mockLogin = jest.fn();

jest.mock('../api/auth', () => ({
  requestPhoneCode: (...args: unknown[]) => mockRequestPhoneCode(...args),
  verifyPhoneCode: (...args: unknown[]) => mockVerifyPhoneCode(...args),
  registerWithPhone: (...args: unknown[]) => mockRegisterWithPhone(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  register: jest.fn(),
  logout: jest.fn(),
  me: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
}));

jest.mock('../auth/storage', () => ({
  clearAuthTokens: jest.fn().mockResolvedValue(undefined),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  deleteAccessToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
}));

import PhoneEntry from '../../app/(auth)/phone';
import OtpScreen from '../../app/(auth)/otp';
import RegisterDetails from '../../app/(auth)/register-details';
import Login from '../../app/(auth)/login';

const mounted: renderer.ReactTestRenderer[] = [];

function render(Screen: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <LocaleProvider>
          <SafeAreaProvider
            initialMetrics={{
              frame: { x: 0, y: 0, width: 390, height: 844 },
              insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
          >
            <QueryClientProvider client={queryClient}>
              <Screen />
            </QueryClientProvider>
          </SafeAreaProvider>
        </LocaleProvider>
      </ThemeProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

/** Every string the screen renders, flattened, so copy can be asserted on. */
function textOf(tree: renderer.ReactTestRenderer): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
  };
  tree.root.findAll((node) => typeof node.type === 'string').forEach((node) => walk(node.props.children));
  return parts.join(' ');
}

/** The component carrying this accessibility label and an onPress. */
function control(tree: renderer.ReactTestRenderer, accessibilityLabel: string) {
  const match = tree.root
    .findAll(
      (node) =>
        (node.props as { accessibilityLabel?: string }).accessibilityLabel === accessibilityLabel &&
        typeof (node.props as { onPress?: unknown }).onPress === 'function',
      { deep: true },
    )
    .at(0);
  if (!match) throw new Error(`No pressable labelled "${accessibilityLabel}"`);
  return match;
}

/**
 * The input carrying this label.
 *
 * Matched on `accessibilityLabel` or the visible `label`, because a form has
 * both kinds: a field whose label says everything needs no second one, and a
 * field whose visible label is ambiguous out of context gets an explicit one.
 */
function field(tree: renderer.ReactTestRenderer, label: string) {
  const match = tree.root
    .findAll(
      (node) => {
        const props = node.props as { accessibilityLabel?: string; label?: string; onChangeText?: unknown };
        return (
          (props.accessibilityLabel === label || props.label === label) &&
          typeof props.onChangeText === 'function'
        );
      },
      { deep: true },
    )
    .at(-1);
  if (!match) throw new Error(`No input labelled "${label}"`);
  return match;
}

const type = (node: { props: { onChangeText?: (text: string) => void } }, text: string) =>
  act(() => {
    node.props.onChangeText?.(text);
  });

const press = async (node: { props: { onPress?: () => unknown } }) =>
  act(async () => {
    await node.props.onPress?.();
  });

const flush = async () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  mockRouteParams = {};
  jest.clearAllMocks();
  mockRequestPhoneCode.mockResolvedValue({
    sentTo: '+998*******67',
    expiresInSeconds: 300,
    resendAvailableInSeconds: 60,
  });
  mockVerifyPhoneCode.mockResolvedValue({ verificationToken: 'ticket-abc', expiresInSeconds: 900 });
  mockRegisterWithPhone.mockResolvedValue({
    accessToken: 'a',
    refreshToken: 'r',
    user: {
      id: 'u-1',
      email: '998901234567@phone.bloodchain.local',
      firstName: 'Aziz',
      lastName: 'Karimov',
      displayName: null,
      status: 'ACTIVE',
      roles: ['DONOR'],
      permissions: [],
    },
  });
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
});

const apiError = (statusCode: number, code: string, message: string, details?: unknown) =>
  new ApiRequestError({ statusCode, code, message, details });

describe('the phone number screen', () => {
  it('sends the number in E.164, whatever the donor typed', async () => {
    const tree = render(PhoneEntry);

    // Typed with the spaces people actually use.
    type(field(tree, 'Phone number, Uzbekistan'), '90 123 45 67');
    await press(control(tree, 'Send a verification code by SMS'));

    // The server sees one spelling. Anything else and `User.phone`'s
    // uniqueness stops meaning anything.
    expect(mockRequestPhoneCode).toHaveBeenCalledWith('+998901234567', 'REGISTRATION', 'en');
  });

  it('will not submit an incomplete number', async () => {
    const tree = render(PhoneEntry);

    type(field(tree, 'Phone number, Uzbekistan'), '9012345');
    await press(control(tree, 'Send a verification code by SMS'));

    expect(mockRequestPhoneCode).not.toHaveBeenCalled();
  });

  it('carries the masked number to the code screen, never the full one', async () => {
    const tree = render(PhoneEntry);

    type(field(tree, 'Phone number, Uzbekistan'), '901234567');
    await press(control(tree, 'Send a verification code by SMS'));

    const [{ params }] = mockPush.mock.calls[0];
    expect(params.sentTo).toBe('+998*******67');
    expect(params.resendIn).toBe('60');
  });

  it('says what the server said, in the donor language', async () => {
    mockRequestPhoneCode.mockImplementation(async () => {
      throw apiError(429, 'AUTH_OTP_RATE_LIMITED', 'Too many codes requested for this number.');
    });
    const tree = render(PhoneEntry);

    type(field(tree, 'Phone number, Uzbekistan'), '901234567');
    await press(control(tree, 'Send a verification code by SMS'));

    expect(textOf(tree)).toContain('Too many codes requested for this number. Try again later.');
  });

  it('asks for a code the same way for recovery', async () => {
    mockRouteParams = { purpose: 'PASSWORD_RESET' };
    const tree = render(PhoneEntry);

    type(field(tree, 'Phone number, Uzbekistan'), '901234567');
    await press(control(tree, 'Send a verification code by SMS'));

    expect(mockRequestPhoneCode).toHaveBeenCalledWith('+998901234567', 'PASSWORD_RESET', 'en');
  });
});

describe('the code screen', () => {
  beforeEach(() => {
    mockRouteParams = {
      phone: '+998901234567',
      purpose: 'REGISTRATION',
      sentTo: '+998*******67',
      resendIn: '0',
    };
  });

  it('shows the masked number, not the number', () => {
    const tree = render(OtpScreen);

    const text = textOf(tree);
    expect(text).toContain('+998*******67');
    expect(text).not.toContain('+998901234567');
  });

  it('submits by itself once six digits are in', async () => {
    const tree = render(OtpScreen);

    type(field(tree, 'Six-digit verification code'), '123456');
    await flush();

    // By the sixth digit there is nothing left to decide; making the donor
    // find a button is asking them to confirm a decision they already made.
    expect(mockVerifyPhoneCode).toHaveBeenCalledWith('+998901234567', 'REGISTRATION', '123456');
  });

  it('does not submit a partial code', async () => {
    const tree = render(OtpScreen);

    type(field(tree, 'Six-digit verification code'), '123');
    await flush();

    expect(mockVerifyPhoneCode).not.toHaveBeenCalled();
  });

  it('carries the signed ticket to the details screen, and nothing else', async () => {
    const tree = render(OtpScreen);

    type(field(tree, 'Six-digit verification code'), '123456');
    await flush();

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/register-details',
      params: { verificationToken: 'ticket-abc', phone: '+998901234567' },
    });
  });

  it('sends a recovery code straight into the existing reset screen', async () => {
    mockRouteParams = { ...mockRouteParams, purpose: 'PASSWORD_RESET' };
    mockVerifyPhoneCode.mockResolvedValue({ resetToken: 'reset-xyz', expiresInMinutes: 60 });
    const tree = render(OtpScreen);

    type(field(tree, 'Six-digit verification code'), '123456');
    await flush();

    // One recovery flow reached two ways -- not a second, weaker one.
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/reset-password',
      params: { token: 'reset-xyz' },
    });
  });

  it('explains a wrong code and keeps the donor on the screen', async () => {
    mockVerifyPhoneCode.mockImplementation(async () => {
      throw apiError(400, 'AUTH_OTP_INVALID', 'That code is not correct.');
    });
    const tree = render(OtpScreen);

    type(field(tree, 'Six-digit verification code'), '000000');
    await flush();

    expect(textOf(tree)).toContain('That code is not correct.');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears the field when the code is dead, rather than leaving six wrong digits', async () => {
    mockVerifyPhoneCode.mockImplementation(async () => {
      throw apiError(400, 'AUTH_OTP_EXPIRED', 'That code has expired.');
    });
    const tree = render(OtpScreen);

    type(field(tree, 'Six-digit verification code'), '123456');
    await flush();

    expect(field(tree, 'Six-digit verification code').props.value).toBe('');
    expect(textOf(tree)).toContain('That code has expired. Request a new one.');
  });

  it('offers a resend only once the cooldown has run out', async () => {
    mockRouteParams = { ...mockRouteParams, resendIn: '45' };
    const tree = render(OtpScreen);

    // A button that looks pressable and answers 429 teaches a donor that the
    // app is broken. The wait is stated instead.
    expect(textOf(tree)).toContain('You can ask for a new code in 45 s');
    expect(() => control(tree, 'Send a new verification code')).toThrow();
  });

  it('resends, and starts the countdown again', async () => {
    const tree = render(OtpScreen);

    await press(control(tree, 'Send a new verification code'));

    expect(mockRequestPhoneCode).toHaveBeenCalledWith('+998901234567', 'REGISTRATION', 'en');
    expect(textOf(tree)).toContain('You can ask for a new code in 60 s');
  });

  it('trusts the server over its own clock when a resend is refused', async () => {
    mockRequestPhoneCode.mockImplementation(async () => {
      throw apiError(429, 'AUTH_OTP_COOLDOWN', 'Wait 30 seconds.', { retryAfterSeconds: 30 });
    });
    const tree = render(OtpScreen);

    await press(control(tree, 'Send a new verification code'));

    expect(textOf(tree)).toContain('You can ask for a new code in 30 s');
  });
});

describe('the details screen', () => {
  beforeEach(() => {
    mockRouteParams = { verificationToken: 'ticket-abc', phone: '+998901234567' };
  });

  it('registers with the ticket the server signed', async () => {
    const tree = render(RegisterDetails);

    type(field(tree, 'First name'), 'Aziz');
    type(field(tree, 'Last name'), 'Karimov');
    type(field(tree, 'Password'), 'DevelopmentOnly!123');
    await press(control(tree, 'Create your account'));
    await flush();

    // The number is inside the ticket, signed. The client never gets to say
    // which number was verified -- that is the whole point of the ticket.
    expect(mockRegisterWithPhone).toHaveBeenCalledWith({
      verificationToken: 'ticket-abc',
      firstName: 'Aziz',
      lastName: 'Karimov',
      password: 'DevelopmentOnly!123',
      email: undefined,
    });
  });

  it('sends an email only when one was given', async () => {
    const tree = render(RegisterDetails);

    type(field(tree, 'First name'), 'Aziz');
    type(field(tree, 'Last name'), 'Karimov');
    type(field(tree, 'Password'), 'DevelopmentOnly!123');
    type(field(tree, 'Email address (optional)'), 'aziz@example.uz');
    await press(control(tree, 'Create your account'));
    await flush();

    expect(mockRegisterWithPhone).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'aziz@example.uz' }),
    );
  });

  it('refuses a password the API would refuse, before spending the ticket', async () => {
    const tree = render(RegisterDetails);

    type(field(tree, 'First name'), 'Aziz');
    type(field(tree, 'Last name'), 'Karimov');
    type(field(tree, 'Password'), 'short');
    await press(control(tree, 'Create your account'));
    await flush();

    expect(mockRegisterWithPhone).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Password must be at least 12 characters');
  });

  it('explains an expired ticket in the donor language', async () => {
    mockRegisterWithPhone.mockImplementation(async () => {
      throw apiError(400, 'AUTH_VERIFICATION_TICKET_INVALID', 'Phone verification has expired.');
    });
    const tree = render(RegisterDetails);

    type(field(tree, 'First name'), 'Aziz');
    type(field(tree, 'Last name'), 'Karimov');
    type(field(tree, 'Password'), 'DevelopmentOnly!123');
    await press(control(tree, 'Create your account'));
    await flush();

    expect(textOf(tree)).toContain('Phone verification has expired. Request a new code.');
  });
});

describe('signing in', () => {
  it('signs in by phone number, normalised', async () => {
    mockLogin.mockResolvedValue({ user: { roles: ['DONOR'] } });
    const tree = render(Login);

    type(field(tree, 'Phone number, Uzbekistan'), '90 123 45 67');
    type(field(tree, 'Password'), 'DevelopmentOnly!123');
    await press(control(tree, 'Sign in to Bloodchain'));
    await flush();

    // One spelling reaches the API, so the account found is the account that
    // was registered. (React Query passes its own second argument; only the
    // first is ours.)
    expect(mockLogin.mock.calls[0]?.[0]).toEqual({
      phone: '+998901234567',
      password: 'DevelopmentOnly!123',
    });
  });

  it('still signs in by email, which every account made before this sprint uses', async () => {
    mockLogin.mockResolvedValue({ user: { roles: ['DONOR'] } });
    const tree = render(Login);

    await press(control(tree, 'Use my email address'));
    type(field(tree, 'Email address'), 'donor@donor.local');
    type(field(tree, 'Password'), 'DevelopmentOnly!123');
    await press(control(tree, 'Sign in to Bloodchain'));
    await flush();

    expect(mockLogin.mock.calls[0]?.[0]).toEqual({
      email: 'donor@donor.local',
      password: 'DevelopmentOnly!123',
    });
  });

  it('refuses to send an incomplete number to the server', async () => {
    const tree = render(Login);

    type(field(tree, 'Phone number, Uzbekistan'), '9012');
    type(field(tree, 'Password'), 'DevelopmentOnly!123');
    await press(control(tree, 'Sign in to Bloodchain'));
    await flush();

    expect(mockLogin).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Enter an Uzbekistan phone number');
  });

  it('says the same thing for an unknown number as for a wrong password', async () => {
    mockLogin.mockImplementation(async () => {
      throw apiError(401, 'AUTH_INVALID_CREDENTIALS', 'Phone number or password is incorrect.');
    });
    const tree = render(Login);

    type(field(tree, 'Phone number, Uzbekistan'), '901234567');
    type(field(tree, 'Password'), 'wrong-password');
    await press(control(tree, 'Sign in to Bloodchain'));
    await flush();

    // The screen must not be more helpful than the API: "no account with that
    // number" is how someone finds out who donates blood here.
    expect(textOf(tree)).toContain('Those sign-in details are not correct.');
  });
});
