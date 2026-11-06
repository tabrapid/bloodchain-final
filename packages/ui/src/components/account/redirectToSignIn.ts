/** Discard authenticated client state even when signing out from the root route. */
export function redirectToSignIn(): void {
  window.location.assign('/');
}
