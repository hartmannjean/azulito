"use server";

import { revalidatePath } from "next/cache";
import { uploadOfx } from "@/lib/api-client";
import { getAccess } from "@/lib/access";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type ImportState = { message?: string; error?: string };

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Recebe o OFX enviado pelo `ImportOfxButton` (Client Component). Roda no
 * servidor da apps/web: lê o JWT do Cloudflare Access do request (verificado
 * em `getAccess`) e repassa os bytes do arquivo à apps/api — que é quem
 * valida o conteúdo de verdade. As checagens daqui (tipo/tamanho) só evitam
 * mandar lixo óbvio pela rede.
 */
export async function importOfx(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const dict = getDictionary(await getLocale());

  const access = await getAccess();
  if (!access) {
    return { error: dict.auth.errors.notAuthenticated };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: dict.dashboard.importErrors.missingFile };
  }
  if (!/\.(ofx|qfx)$/i.test(file.name)) {
    return { error: dict.dashboard.importErrors.invalidType };
  }
  if (file.size > MAX_BYTES) {
    return { error: dict.dashboard.importErrors.tooLarge };
  }

  try {
    const result = await uploadOfx(access.jwt, await file.arrayBuffer(), file.name);
    revalidatePath("/dashboard");
    return { message: dict.dashboard.importResult(result.imported, result.duplicates) };
  } catch (error) {
    console.error("Falha ao importar OFX:", error);
    return { error: dict.dashboard.importErrors.failed };
  }
}
