"use client";

import { useState } from "react";
import { requestConnectToken } from "@/app/dashboard/actions";

/**
 * TODO(pluggy): placeholder do botão que abre o Pluggy Connect Widget.
 *
 * Quando a integração real entrar:
 * 1. Carregar o script do Pluggy Connect Widget (checar a URL atual na doc
 *    oficial) e adicionar essa origem ao `script-src` da CSP em
 *    `lib/csp.ts` — não afrouxar a CSP para "unsafe-inline"/wildcard.
 * 2. `requestConnectToken` (Server Action, app/dashboard/actions.ts) já
 *    retorna o `accessToken` da Pluggy — falta só inicializar o widget com
 *    ele no callback de sucesso.
 * 3. A gravação da bank_connection deve continuar acontecendo no backend
 *    (webhook `item/created`, apps/api), nunca a partir de dados vindos do
 *    client.
 */
export function ConnectBankButton({ hasConnection }: { hasConnection: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    const result = await requestConnectToken();
    setStatus(result.error ? "error" : "idle");

    if (!result.error) {
      // TODO(pluggy): usar result.accessToken para abrir o Pluggy Connect Widget.
      window.alert(
        "Integração com a Pluggy ainda não implementada. O connect-token " +
          "foi obtido, mas o widget de conexão real ainda precisa ser " +
          "adicionado (ver TODO(pluggy) em connect-bank-button.tsx).",
      );
    }
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
    </div>
  );
}
