import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function SettingsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const subpath = query.size > 0 ? `/settings?${query.toString()}` : "/settings";
  await redirectToPreferredWorkspace(subpath);
}
