import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDefaultPathForRole, getSafeInternalPath } from "../../../lib/auth/redirect";
import { ensureProfileForUser, normalizeRole } from "../../../lib/auth/profile";

type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

function redirectWithError(origin: string, path: string, message: string) {
  const url = new URL(path, origin);
  url.searchParams.set("auth_error", message);

  return NextResponse.redirect(url);
}

function getErrorTarget(requestedRole: ReturnType<typeof normalizeRole>) {
  return requestedRole ? "/auth/sign-up" : "/auth/sign-in";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const code = requestUrl.searchParams.get("code");
  const providerError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error") ??
    "";
  const nextPath = getSafeInternalPath(requestUrl.searchParams.get("next"));
  const requestedRole = normalizeRole(requestUrl.searchParams.get("role"));
  const errorTarget = getErrorTarget(requestedRole);

  if (providerError) {
    return redirectWithError(origin, errorTarget, providerError);
  }

  if (!code) {
    return redirectWithError(
      origin,
      errorTarget,
      "No se recibio el codigo de Google. Revisa la configuracion del proveedor en Supabase."
    );
  }

  const cookieStore = await cookies();
  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(nextCookies) {
          cookiesToSet.push(...nextCookies);
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectWithError(origin, errorTarget, exchangeError.message);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectWithError(
      origin,
      errorTarget,
      userError?.message ?? "No se pudo crear la sesion con Google."
    );
  }

  const profile = await ensureProfileForUser(supabase, user, requestedRole);
  const targetPath = profile.role
    ? getDefaultPathForRole(profile.role, nextPath)
    : `/auth/complete-profile?next=${encodeURIComponent(nextPath)}`;
  const response = NextResponse.redirect(new URL(targetPath, origin));

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
