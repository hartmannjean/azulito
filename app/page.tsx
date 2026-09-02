import { redirect } from "next/navigation";

// O middleware já garante que só chega aqui quem está autenticado (usuários
// sem sessão são redirecionados para /login antes deste componente rodar).
export default function RootPage() {
  redirect("/dashboard");
}
