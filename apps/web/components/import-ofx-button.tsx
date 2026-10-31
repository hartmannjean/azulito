"use client";

import { useActionState, useRef } from "react";
import { importOfx, type ImportState } from "@/app/dashboard/actions";

/**
 * O botão abre o seletor de arquivo e envia o formulário assim que um OFX é
 * escolhido — `importOfx` (Server Action) faz o upload à apps/api e revalida
 * o dashboard.
 */
export function ImportOfxButton({
  importLabel,
  importingLabel,
}: {
  importLabel: string;
  importingLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importOfx, {});
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction}>
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".ofx,.qfx"
        hidden
        onChange={() => formRef.current?.requestSubmit()}
      />
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        {pending ? importingLabel : importLabel}
      </button>
      {state.message ? <p className="transaction-meta">{state.message}</p> : null}
      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
