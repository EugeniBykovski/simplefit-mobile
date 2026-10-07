/**
 * The email challenge the app is in the middle of, between the email screen
 * and the code screen.
 *
 * Kept in memory only, never in a route parameter (paths and their query
 * appear in navigation state and logs) and never in storage: the normalized
 * email address and, for sign-up, the registration token, which is worthless
 * without the emailed code. Restarting the app restarts the flow. Sign-up and
 * sign-in are separate records: a registration token is never turned into a
 * sign-in credential.
 */
export type PendingSignIn = { email: string; resendAt: number };
export type PendingRegistration = { email: string; registrationToken: string; resendAt: number };

type Records = { signIn?: PendingSignIn; registration?: PendingRegistration };

const records: Records = {};

export const pending = {
  get: <K extends keyof Records>(kind: K): Records[K] => records[kind],
  set: <K extends keyof Records>(kind: K, value: NonNullable<Records[K]>) => {
    records[kind] = value;
  },
  clear: (kind: keyof Records) => {
    delete records[kind];
  },
};

/** The API's canonical form of an address (trim, ASCII lower case), for display and reuse. */
export function normalizeEmail(email: string): string {
  return email.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/** When a resend is allowed again, from the API's `resend_after_seconds`. */
export const resendAtFrom = (seconds: number, now = Date.now()) => now + seconds * 1000;
