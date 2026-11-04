import type { ActionLogEntry } from "@azulito/shared";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { translateCategory } from "@/lib/i18n/category-names";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locale";

const text = (value: unknown, max = 80): string => (typeof value === "string" ? value.slice(0, max) : "");
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const monthOrNull = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;

/**
 * Frase da ação no histórico/aviso de desfazer. `meta` vem do banco como JSON
 * solto, então cada campo é validado antes de entrar no texto (React escapa o
 * resultado; aqui só garantimos tipo e tamanho).
 */
export function describeAction(entry: ActionLogEntry, locale: Locale, dict: Dictionary): string {
  const k = dict.history.kinds;
  const m = entry.meta;
  const category = (name: unknown) => translateCategory(text(name), locale) ?? text(name);

  switch (entry.kind) {
    case "category_set":
      return k.category_set(text(m.description, 60), category(m.category), num(m.others));
    case "reference_month": {
      const month = monthOrNull(m.month);
      return k.reference_month(num(m.count), month ? formatMonthLabel(month, locale) : null);
    }
    case "categorize":
      return k.categorize(num(m.count));
    case "budget_set":
      return k.budget_set(category(m.category), formatCurrency(num(m.limit), locale));
    case "budget_remove":
      return k.budget_remove(category(m.category));
    case "category_create":
      return k.category_create(text(m.name, 40));
    case "category_delete":
      return k.category_delete(text(m.name, 40));
    case "card_cycle":
      return k.card_cycle(num(m.closing), num(m.due));
    case "savings_set": {
      const month = monthOrNull(m.month);
      return k.savings_set(month ? formatMonthLabel(month, locale) : "", formatCurrency(num(m.balance), locale));
    }
    case "savings_remove": {
      const month = monthOrNull(m.month);
      return k.savings_remove(month ? formatMonthLabel(month, locale) : "");
    }
    case "scheduled_create":
      return k.scheduled_create(
        text(m.kind, 10),
        text(m.description, 60),
        formatCurrency(num(m.amount), locale),
        text(m.due_date, 10),
      );
    case "scheduled_paid":
      return k.scheduled_paid(text(m.description, 60), m.paid === true);
    case "scheduled_delete":
      return k.scheduled_delete(text(m.description, 60));
    case "category_rename":
      return k.category_rename(text(m.from, 40), text(m.to, 40));
    case "ai_budget":
      return k.ai_budget();
    case "ai_recurring":
      return k.ai_recurring();
    case "ai_audit":
      return k.ai_audit();
    case "insight":
      return k.insight();
    case "import":
      return k.import(text(m.file, 80) || null, num(m.imported));
    default:
      return dict.history.unknown;
  }
}
