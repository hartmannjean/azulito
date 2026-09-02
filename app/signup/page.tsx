import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signup } from "./actions";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <h1>Criar conta</h1>
      <AuthForm action={signup} submitLabel="Criar conta" />
      <p>
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
