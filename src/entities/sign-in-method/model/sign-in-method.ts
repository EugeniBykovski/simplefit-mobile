import { useQuery } from "@tanstack/react-query";

import { callWithSession } from "@/entities/session";
import {
  getListMySignInMethodsQueryKey,
  listMySignInMethods,
} from "@/shared/api/generated/endpoints/account/account";
import type { SignInMethodListSignInMethodsItem } from "@/shared/api/generated/model";

/**
 * How the signed-in account can be signed in to (SF-161;
 * `GET /api/v1/me/sign-in-methods`): its proven email addresses and the
 * Google or Apple accounts that signed in to it. The backend never returns a
 * provider's account id or a credential; the app keeps nothing of its own.
 */
export type SignInMethod = SignInMethodListSignInMethodsItem;

export const signInMethodsQueryKey = getListMySignInMethodsQueryKey();

/** The account's sign-in methods, read fresh on every screen entry. */
export function useSignInMethods() {
  return useQuery({
    queryKey: signInMethodsQueryKey,
    queryFn: async ({ signal }) =>
      (await callWithSession((init) => listMySignInMethods({ ...init, signal }))).sign_in_methods,
    retry: false,
    staleTime: 0,
  });
}

/** The account's proven email addresses, oldest first. */
export const emailsOf = (methods: readonly SignInMethod[]): string[] =>
  methods.flatMap((method) =>
    method.provider === "email" && method.email !== null ? [method.email] : [],
  );
