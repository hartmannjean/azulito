"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertSettingsSchema } from "@azulito/shared";
import { saveSettings, skipSettings } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type SettingsState = { error?: string; saved?: boolean };

/** "5.432,10" ou "5432.10" → 5432.1; vazio → null; texto inválido → NaN (o esquema recusa). */
function parseMoney(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").replace(/[R$\s]/g, "");
  if (text === "") return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : Number.NaN;
}

function parseDay(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  return /^\d{1,2}$/.test(text) ? Number(text) : Number.NaN;
}

function readForm(formData: FormData) {
  return upsertSettingsSchema.safeParse({
    salary_amount: parseMoney(formData.get("salary_amount")),
    salary_day: parseDay(formData.get("salary_day")),
    card_closing_day: parseDay(formData.get("card_closing_day")),
    card_due_day: parseDay(formData.get("card_due_day")),
  });
}

async function save(formData: FormData): Promise<SettingsState> {
  const dict = getDictionary(await getLocale());
  const session = await getSession();
  if (!session) return { error: dict.auth.errors.notAuthenticated };

  const parsed = readForm(formData);
  if (!parsed.success) return { error: dict.welcome.errors.invalid };

  try {
    await saveSettings(session.cookie, parsed.data);
  } catch (error) {
    console.error("Falha ao salvar as preferências:", error);
    return { error: dict.welcome.errors.failed };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Salva na página Conta e continua nela. */
export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  return save(formData);
}

/** Tela de boas-vindas: salva e segue para o painel. */
export async function completeWelcomeAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const result = await save(formData);
  if (result.error) return result;
  redirect("/dash");
}

/** Tela de boas-vindas: pular as perguntas (não pergunta de novo no próximo acesso). */
export async function skipWelcomeAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await skipSettings(session.cookie);
    } catch (error) {
      console.error("Falha ao pular as perguntas iniciais:", error);
    }
  }
  redirect("/dash");
}
