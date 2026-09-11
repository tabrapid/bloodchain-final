import { execFileSync } from 'node:child_process';
import { platform } from 'node:os';

/**
 * Whether macOS is dropping incoming connections.
 *
 * This is the difference that makes the failure so confusing: connections that
 * are *refused* fail instantly, while connections whose packets are *dropped*
 * hang until they time out -- which reads as a slow server rather than a closed
 * door. Stealth mode drops them silently by design, and the application
 * firewall does the same for a binary that has not been allowed.
 *
 * Metro and the API are usually the same `node` binary, so allowing one often
 * allows the other -- but not when they are launched from different Node
 * installs, which is exactly when the bundle loads and the API does not.
 *
 * Kept free of side effects so it can be tested without running a health check.
 */
export function parseFirewallState(globalOutput, stealthOutput) {
  return {
    enabled: /State = 1/.test(globalOutput ?? ''),
    stealth: /State = 1/.test(stealthOutput ?? ''),
  };
}

/** Reads the live state, or null when this is not a Mac or the tool is absent. */
export function macFirewall() {
  if (platform() !== 'darwin') return null;
  const ask = (flag) => {
    try {
      return execFileSync('/usr/libexec/ApplicationFirewall/socketfilterfw', [flag], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
  const global = ask('--getglobalstate');
  if (global === null) return null;
  return parseFirewallState(global, ask('--getstealthmode'));
}
