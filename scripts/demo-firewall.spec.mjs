import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFirewallState } from './demo-firewall.mjs';

/**
 * `socketfilterfw` reports state as prose with a "(State = N)" suffix. Reading
 * it wrongly would either hide a stealth mode that is silently dropping the
 * phone's connections, or cry wolf about a firewall that is off.
 */
test('reads an enabled firewall with stealth mode on', () => {
  const state = parseFirewallState(
    'Firewall is enabled. (State = 1)',
    'Firewall stealth mode is on. (State = 1)',
  );
  assert.deepEqual(state, { enabled: true, stealth: true });
});

test('reads an enabled firewall with stealth mode off', () => {
  const state = parseFirewallState(
    'Firewall is enabled. (State = 1)',
    'Firewall stealth mode is off. (State = 0)',
  );
  assert.deepEqual(state, { enabled: true, stealth: false });
});

test('reads a disabled firewall', () => {
  const state = parseFirewallState(
    'Firewall is disabled. (State = 0)',
    'Firewall stealth mode is off. (State = 0)',
  );
  assert.deepEqual(state, { enabled: false, stealth: false });
});

test('treats missing output as neither enabled nor stealthed, rather than throwing', () => {
  assert.deepEqual(parseFirewallState(null, null), { enabled: false, stealth: false });
});
