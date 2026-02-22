import { isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".test",
  ".example",
  ".invalid",
  ".home.arpa",
  ".lan",
] as const;

export function normalizeAndValidateCrawlUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const parsed = new URL(url);
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw new Error("Invalid hostname");
  }

  assertSafePublicHttpUrl(parsed.href);

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function assertSafePublicHttpUrl(url: string): void {
  if (!isSafePublicHttpUrl(url)) {
    throw new Error("Unsafe URL");
  }
}

export function isSafePublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    // Block credentialed URLs entirely.
    if (parsed.username || parsed.password) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (host === "localhost") {
      return false;
    }

    if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
      return false;
    }

    const ipType = isIP(host);
    if (ipType === 4 && isPrivateOrReservedIpv4(host)) {
      return false;
    }
    if (ipType === 6 && isPrivateOrReservedIpv6(host)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function isAllowedSameSiteUrl(
  url: string,
  expectedHostname: string
): boolean {
  if (!isSafePublicHttpUrl(url)) {
    return false;
  }

  try {
    const host = new URL(url).hostname.toLowerCase();
    const expected = expectedHostname.toLowerCase();
    return areSameSiteHosts(host, expected);
  } catch {
    return false;
  }
}

function areSameSiteHosts(host: string, expectedHost: string): boolean {
  const normalize = (value: string) => value.replace(/^www\./, "");
  const a = normalize(host);
  const b = normalize(expectedHost);

  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return true;
  }

  const [a, b] = parts;

  // RFC1918 + loopback + link-local + CGNAT + docs + multicast/reserved.
  if (a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 0) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;

  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback, unspecified, IPv4-mapped loopback/link-local, unique local, link-local.
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.includes("::ffff:127.")) return true;
  if (normalized.includes("::ffff:10.")) return true;
  if (normalized.includes("::ffff:192.168.")) return true;

  return false;
}
