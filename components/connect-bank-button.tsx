"use client";

import { useState } from "react";

/**
 * TODO(pluggy): placeholder do botão que abre o Pluggy Connect Widget.
 *
 * Quando a integração real entrar:
 * 1. Carregar o script do Pluggy Connect Widget (checar a URL atual na doc
 *    oficial) e adicionar essa origem ao `script-src` da CSP em
 *    `next.config.js` — não afrouxar a CSP para "unsafe-inline"/wildcard.
 * 2. No clique, chamar POST /api/pluggy/connect-token (já implementado e
 *    protegido) para obter o `accessToken`.
 * 3. Inicializar o widget com esse token e, no callback de sucesso, apenas
 *    informar o usuário — a gravação da bank_connection deve acontecer no
 *    backend (webhook `item/created` ou uma rota dedicada), nunca a partir
 *    de dados que vieram do client.
 */
export function ConnectBankButton({ hasConnection }: { hasConnection: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const response = await fetch("/api/pluggy/connect-token", { method: "POST" });
      if (!response.ok) {
        throw new Error("failed");
      }
      // TODO(pluggy): usar o accessToken para abrir o Pluggy Connect Widget.
      setStatus("idle");
      window.alert(
        "Integração com a Pluggy ainda não implementada. O endpoint de " +
          "connect-token respondeu, mas o widget de conexão real ainda " +
          "precisa ser adicionado (ver TODO(pluggy) em connect-bank-button.tsx).",
      );
    } catch {
      setStatus("error");
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
