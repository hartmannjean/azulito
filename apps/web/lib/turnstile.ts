import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Chave PÚBLICA do Turnstile (fica em `vars` do wrangler; não é segredo). */
export function getTurnstileSiteKey(): string | undefined {
  let siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey) {
    try {
      siteKey = (getCloudflareContext().env as { TURNSTILE_SITE_KEY?: string }).TURNSTILE_SITE_KEY;
    } catch {
      // Fora do runtime da Cloudflare.
    }
  }
  return siteKey;
}
