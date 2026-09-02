import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string }>;
}) {
  const { signup } = await searchParams;

  return (
    <main className="auth-page">
      <h1>Entrar</h1>
      {signup === "success" ? (
        <p className="form-notice">
          Conta criada. Verifique seu e-mail se a confirmação estiver
          habilitada, depois entre abaixo.
        </p>
      ) : null}
      <AuthForm action={login} submitLabel="Entrar" />
      <p>
        Não tem conta? <Link href="/signup">Criar conta</Link>
      </p>
    </main>
  );
}
