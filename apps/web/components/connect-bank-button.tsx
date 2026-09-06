"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { requestConnectToken } from "@/app/dashboard/actions";

// react-pluggy-connect (via a lib `zoid`, por baixo) acessa `window` na
// avaliação do módulo — quebra o SSR do Next.js mesmo dentro de um "use
// client", que ainda é renderizado no servidor na primeira passada. `ssr:
// false` garante que só é importado no browser.
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

/**
 * A gravação da bank_connection acontece no backend (webhook `item/created`,
 * apps/api), nunca a partir do `item` que o widget devolve em onSuccess —
 * aqui só disparamos um refresh pra Server Component reler o que o backend
 * já persistiu.
 */
export function ConnectBankButton({ hasConnection }: { hasConnection: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [connectToken, setConnectToken] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    const result = await requestConnectToken();

    if (result.error || !result.accessToken) {
      setStatus("error");
      return;
    }

    setStatus("idle");
    setConnectToken(result.accessToken);
  }

  return (
    <div>
      <button type="button" className="button secondary" onClick={handleClick}>
        {hasConnection ? "Reconectar Nubank" : "Conectar Nubank"}
      </button>
      {status === "loading" ? <p className="transaction-meta">Iniciando conexão...</p> : null}
      {status === "error" ? (
        <p className="form-error">Não foi possível iniciar a conexão. Tente novamente.</p>
      ) : null}
      {connectToken ? (
        <PluggyConnect
          connectToken={connectToken}
          // TODO(pluggy): trocar para `false` quando o projeto passar a usar
          // credenciais de produção — sandbox só existe pra testar o fluxo
          // com o conector fake "Pluggy Bank", nunca com o Nubank real.
          includeSandbox={true}
          onSuccess={() => {
            setConnectToken(null);
            router.refresh();
          }}
          onError={() => {
            setConnectToken(null);
            setStatus("error");
          }}
          onClose={() => setConnectToken(null)}
        />
      ) : null}
    </div>
  );
}
