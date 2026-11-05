import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import "@/app/marketing.css";

/**
 * Páginas privadas de tela cheia (sem a barra lateral), como as perguntas
 * iniciais. Continuam sob /dash e exigem sessão válida, validada pela apps/api.
 */
export default async function FocusLayout({ children }: { children: ReactNode }) {
  if (!(await getSession())) redirect("/login");
  return <div className="welcome">{children}</div>;
}
