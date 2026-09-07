"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthActionState } from "@/lib/validations/auth";

const initialState: AuthActionState = { error: null };

function SubmitButton({ label, sendingLabel }: { label: string; sendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" disabled={pending}>
      {pending ? sendingLabel : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  emailLabel,
  passwordLabel,
  sendingLabel,
}: {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
  emailLabel: string;
  passwordLabel: string;
  sendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="auth-form">
      <label htmlFor="email">{emailLabel}</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
      />

      <label htmlFor="password">{passwordLabel}</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        minLength={8}
        maxLength={128}
        required
      />

      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} sendingLabel={sendingLabel} />
    </form>
  );
}
