import { ptBR } from "./dictionaries/pt-BR";
import { en } from "./dictionaries/en";
import type { Locale } from "./locale";

const dictionaries: Record<Locale, typeof ptBR> = {
  "pt-BR": ptBR,
  en,
};

export function getDictionary(locale: Locale): typeof ptBR {
  return dictionaries[locale];
}

export type Dictionary = typeof ptBR;
