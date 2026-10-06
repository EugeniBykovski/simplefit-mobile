import { z } from "zod";

/**
 * Public runtime configuration.
 *
 * EXPO_PUBLIC_* values are inlined into the JavaScript bundle at build time and
 * can be read by anyone with the app binary: they must never hold secrets.
 * Expo only inlines a variable when it is read as a literal
 * `process.env.EXPO_PUBLIC_*` expression, as below.
 */
export type PublicEnv = {
  /** API base URL without trailing slash. */
  apiUrl: string;
  /**
   * Google OAuth Web client ID (SF-22): the audience of the Google ID tokens
   * the app receives on both platforms. Without it Google sign-in is
   * unavailable.
   */
  googleWebClientId?: string | undefined;
  /** Google OAuth iOS client ID; required for Google sign-in on iOS. */
  googleIosClientId?: string | undefined;
};

type PublicEnvSource = {
  EXPO_PUBLIC_API_URL?: string | undefined;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string | undefined;
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string | undefined;
};

/** A Google OAuth client ID (public, but validated so a typo fails loudly). */
export const GOOGLE_CLIENT_ID = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

const googleClientId = (name: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(
      z
        .string()
        .regex(GOOGLE_CLIENT_ID, { error: `${name} must be a Google OAuth client ID` })
        .optional(),
    )
    .optional();

export function parsePublicEnv(
  source: PublicEnvSource,
  { production }: { production: boolean },
): PublicEnv {
  const schema = z.object({
    EXPO_PUBLIC_API_URL: z
      .url({
        // TLS is mandatory outside development builds.
        protocol: production ? /^https$/ : /^https?$/,
        error: production
          ? "EXPO_PUBLIC_API_URL must be an https URL in production builds"
          : "EXPO_PUBLIC_API_URL must be an http(s) URL (see .env.example)",
      })
      .transform((url) => url.replace(/\/+$/, "")),
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: googleClientId("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: googleClientId("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"),
  });

  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid public environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return {
    apiUrl: result.data.EXPO_PUBLIC_API_URL,
    googleWebClientId: result.data.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    googleIosClientId: result.data.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  };
}

export const publicEnv: PublicEnv = parsePublicEnv(
  {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  },
  { production: !__DEV__ },
);
