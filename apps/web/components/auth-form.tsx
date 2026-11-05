"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

type Labels = {
  nameLabel: string;
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
  acceptPrefix: string;
  acceptLink: string;
  createAccount: string;
  errors: {
    generic: string;
    invalidCode: string;
    tooMany: string;
    captcha: string;
    passkeyFailed: string;
    signupsClosed: string;
    signupRequired: string;
    nameShort: string;
    mustAccept: string;
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

type Failure = { status?: number; code?: string };

/**
 * Entrar e criar conta. O LOGIN nunca cria conta (sem nome o servidor recusa com
 * SIGNUP_REQUIRED); só o CADASTRO envia o nome. Código de e-mail ou passkey.
 */
export function AuthForm({
  mode,
  siteKey,
  labels,
  privacyHref,
  signupHref,
}: {
  mode: "login" | "signup";
  siteKey: string;
  labels: Labels;
  privacyHref: string;
  signupHref: string;
}) {
  const signup = mode === "signup";
  const [step, setStep] = useState<"email" | "code">("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; offerSignup?: boolean } | null>(null);
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
      .catch(() => setError({ text: labels.errors.captcha }));
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
      setToken(null);
    };
  }, [step, siteKey, labels.errors.captcha]);

  function describe(failure: Failure, fallback: string): { text: string; offerSignup?: boolean } {
    if (failure.status === 429) return { text: labels.errors.tooMany };
    if (failure.code === "SIGNUP_REQUIRED") return { text: labels.errors.signupRequired, offerSignup: !signup };
    if (failure.code === "SIGNUPS_CLOSED") return { text: labels.errors.signupsClosed };
    return { text: fallback };
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signup && name.trim().length < 2) return setError({ text: labels.errors.nameShort });
    if (signup && !accepted) return setError({ text: labels.errors.mustAccept });
    if (!token) return setError({ text: labels.errors.captcha });

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
      setError(describe(failure as Failure, failure.status === 400 ? labels.errors.captcha : labels.errors.generic));
      return;
    }
    setCode("");
    setStep("code");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error: failure } = await authClient.signIn.emailOtp({
      email,
      otp: code,
      ...(signup ? { name: name.trim() } : {}),
    });
    if (failure) {
      setPending(false);
      setError(describe(failure as Failure, labels.errors.invalidCode));
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
      setError(describe(failure as Failure, labels.errors.passkeyFailed));
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dash");
  }

  return (
    <div className="stack-form">
      {step === "email" ? (
        <form onSubmit={sendCode} className="stack-form">
          {signup ? (
            <label>
              {labels.nameLabel}
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            {labels.emailLabel}
            <input
              name="email"
              type="email"
              autoComplete={signup ? "email" : "email webauthn"}
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {signup ? (
            <label className="auth-check">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                {labels.acceptPrefix} <Link href={privacyHref}>{labels.acceptLink}</Link>
              </span>
            </label>
          ) : null}
          <div ref={widgetRef} aria-label={labels.humanCheck} />
          <button type="submit" className="button" disabled={pending || !token}>
            {pending ? labels.sending : labels.sendCode}
          </button>
          {signup ? null : (
            <>
              <div className="auth-divider" aria-hidden="true">
                {labels.or}
              </div>
              <button type="button" className="button secondary" onClick={signInWithPasskey} disabled={pending}>
                {labels.passkey}
              </button>
            </>
          )}
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
          {error.text}
          {error.offerSignup ? (
            <>
              {" "}
              <Link href={signupHref}>{labels.createAccount}</Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
