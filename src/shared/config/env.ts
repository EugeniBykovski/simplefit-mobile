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
};

export function parsePublicEnv(
  source: { EXPO_PUBLIC_API_URL?: string | undefined },
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
  });

  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid public environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return { apiUrl: result.data.EXPO_PUBLIC_API_URL };
}

export const publicEnv: PublicEnv = parsePublicEnv(
  { EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL },
  { production: !__DEV__ },
);
