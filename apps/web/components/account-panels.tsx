"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

type Passkey = { id: string; name?: string | null };

export function PasskeysPanel({
  labels,
}: {
  labels: {
    none: string;
    add: string;
    adding: string;
    remove: string;
    added: string;
    failed: string;
  };
}) {
  const [items, setItems] = useState<Passkey[] | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Muda a cada cadastro/remoção para refazer a busca da lista.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    authClient.passkey.listUserPasskeys().then(({ data }) => {
      if (active) setItems((data as Passkey[] | null) ?? []);
    });
    return () => {
      active = false;
    };
  }, [version]);

  async function add() {
    setPending(true);
    setMessage(null);
    const { error } = await authClient.passkey.addPasskey({ name: `Passkey ${new Date().toLocaleDateString()}` });
    setPending(false);
    if (error) {
      setMessage({ text: labels.failed, error: true });
      return;
    }
    setMessage({ text: labels.added, error: false });
    setVersion((v) => v + 1);
  }

  async function remove(id: string) {
    setPending(true);
    await authClient.passkey.deletePasskey({ id });
    setPending(false);
    setVersion((v) => v + 1);
  }

  return (
    <div className="stack-form">
      {items && items.length === 0 ? <p className="muted">{labels.none}</p> : null}
      {items?.map((item) => (
        <div key={item.id} className="toolbar">
          <span>{item.name || "Passkey"}</span>
          <button type="button" className="button secondary small" onClick={() => remove(item.id)} disabled={pending}>
            {labels.remove}
          </button>
        </div>
      ))}
      <button type="button" className="button" onClick={add} disabled={pending}>
        {pending ? labels.adding : labels.add}
      </button>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={message.error ? "form-error" : "muted"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

export function RevokeOthersButton({ labels }: { labels: { button: string; done: string; failed: string } }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function run() {
    setPending(true);
    setMessage(null);
    const { error } = await authClient.revokeOtherSessions();
    setPending(false);
    setMessage(error ? { text: labels.failed, error: true } : { text: labels.done, error: false });
  }

  return (
    <div className="stack-form">
      <button type="button" className="button secondary" onClick={run} disabled={pending}>
        {labels.button}
      </button>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={message.error ? "form-error" : "muted"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteAccountForm({
  email,
  labels,
}: {
  email: string;
  labels: { confirm: string; button: string; deleting: string; recentLogin: string; failed: string };
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.deleteUser();
    if (failure) {
      setPending(false);
      // 4xx: sessão antiga demais (a exclusão exige login nos últimos 10 minutos).
      setError(failure.status && failure.status < 500 ? labels.recentLogin : labels.failed);
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <form onSubmit={submit} className="stack-form">
      <label>
        {labels.confirm} <strong>{email}</strong>
        <input
          name="confirm-email"
          type="email"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      <button type="submit" className="button" disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}>
        {pending ? labels.deleting : labels.button}
      </button>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
