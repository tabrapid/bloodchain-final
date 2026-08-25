/**
 * Where to land a user right after authenticating. Couriers get the
 * courier workspace instead of the donor home tab; anyone else (donors,
 * and any other role that ends up on this donor/courier client) gets the
 * donor experience.
 */
export function getPostAuthRoute(roles: string[]): '/(courier)/active' | '/(app)/home' {
  return roles.includes('COURIER') ? '/(courier)/active' : '/(app)/home';
}
