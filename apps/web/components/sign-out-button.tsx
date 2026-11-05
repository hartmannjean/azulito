"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      // Mesmo se a chamada falhar, volta ao início: sem cookie a sessão some do navegador.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    }
  }

  return (
    <button type="button" className="button secondary small" onClick={signOut} disabled={pending}>
      {label}
    </button>
  );
}
