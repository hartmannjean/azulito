"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

type Labels = {
  emailLabel: string;
  sendCode: string;
  sending: string;
  codeLabel: string;
  /** Contém o marcador {email}, trocado no cliente (funções não cruzam o limite servidor/cliente). */
  codeSent: string;
  verify: string;
  verifying: string;
  useAnotherEmail: string;
  passkey: string;
  or: string;
  humanCheck: string;
  errors: {
    generic: string;
    invalidCode: string;
    tooMany: string;
    captcha: string;
    passkeyFailed: string;
    signupsClosed: string;
  };
};

type TurnstileApi = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";

function loadTurnstile(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject()));
    script.addEventListener("error", () => reject());
  });
}

export function LoginForm({ labels, siteKey }: { labels: Labels; siteKey: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (step !== "email") return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !widgetRef.current) return;
        widgetId.current = turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          callback: (value: string) => setToken(value),
          "expired-callback": () => setToken(null),
          "error-callback": () => setToken(null),
        });
      })
      .catch(() => setError(labels.errors.captcha));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      setToken(null);
    };
  }, [step, siteKey, labels.errors.captcha]);

  function messageFor(status: number | undefined, fallback: string): string {
    return status === 429 ? labels.errors.tooMany : fallback;
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError(labels.errors.captcha);
      return;
    }
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
      fetchOptions: { headers: { "x-captcha-response": token } },
    });
    // O token do Turnstile vale uma única vez.
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
    setToken(null);
    setPending(false);

    if (failure) {
      setError(messageFor(failure.status, failure.status === 400 ? labels.errors.captcha : labels.errors.generic));
      return;
    }
    setCode("");
    setStep("code");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.signIn.emailOtp({ email, otp: code });
    if (failure) {
      setPending(false);
      setError(failure.status === 403 ? labels.errors.signupsClosed : messageFor(failure.status, labels.errors.invalidCode));
      return;
    }
    // Navegação completa (não router.push): o próximo request já leva o cookie de sessão.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dash");
  }

  async function signInWithPasskey() {
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.signIn.passkey();
    if (failure) {
      setPending(false);
      setError(messageFor(failure.status, labels.errors.passkeyFailed));
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dash");
  }

  return (
    <div className="stack-form">
      {step === "email" ? (
        <form onSubmit={sendCode} className="stack-form">
          <label>
            {labels.emailLabel}
            <input
              name="email"
              type="email"
              autoComplete="email webauthn"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <div ref={widgetRef} aria-label={labels.humanCheck} />
          <button type="submit" className="button" disabled={pending || !token}>
            {pending ? labels.sending : labels.sendCode}
          </button>
          <p className="muted" aria-hidden="true">
            {labels.or}
          </p>
          <button type="button" className="button secondary" onClick={signInWithPasskey} disabled={pending}>
            {labels.passkey}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack-form">
          <p>{labels.codeSent.replace("{email}", email)}</p>
          <label>
            {labels.codeLabel}
            <input
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button type="submit" className="button" disabled={pending || code.length !== 6}>
            {pending ? labels.verifying : labels.verify}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setError(null);
              setStep("email");
            }}
            disabled={pending}
          >
            {labels.useAnotherEmail}
          </button>
        </form>
      )}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
