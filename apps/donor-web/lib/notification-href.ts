/** Native deep links are not web URLs. Only known local sections are navigable. */
export function notificationHref(type: string): string {
  const routes: Record<string, string> = {
    EMERGENCY: '/emergency',
    DONATION: '/donations',
    APPOINTMENT: '/appointments',
    LABORATORY: '/laboratory',
    AI: '/insights',
    GAMIFICATION: '/achievements',
    SECURITY: '/security',
  };
  return routes[type] ?? '/notifications';
}
