import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Cliente do Better Auth (roda no navegador). Fala sempre com o mesmo domínio:
 * /api/auth/* é o proxy do web para a apps/api, então o cookie de sessão é
 * first-party e a api não precisa ser acessível pela internet.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [emailOTPClient(), passkeyClient()],
});
