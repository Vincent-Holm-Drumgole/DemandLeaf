export function sanitizeRelativeRedirectUrl(
  value: string | null | undefined,
  fallback = "/",
) {
  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function buildSignInRedirectHref(
  value: string | null | undefined,
  fallback = "/",
) {
  const redirectUrl = sanitizeRelativeRedirectUrl(value, fallback);
  return `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`;
}
