"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CategoryOption } from "@/components/category-select";

const CategoryOptionsContext = createContext<CategoryOption[]>([]);

/**
 * A lista de categorias é igual para todas as linhas da tabela: ela vai UMA vez
 * no payload (em vez de repetida em cada seletor, 50 linhas x ~30 opções).
 */
export function CategoryOptionsProvider({ options, children }: { options: CategoryOption[]; children: ReactNode }) {
  return <CategoryOptionsContext.Provider value={options}>{children}</CategoryOptionsContext.Provider>;
}

export function useCategoryOptions(): CategoryOption[] {
  return useContext(CategoryOptionsContext);
}
