// Hook de resolução de módulos para rodar o código real da api fora do Workers:
// - `cloudflare:workers` aponta para um ambiente falso (D1 sobre SQLite em memória);
// - imports relativos `./x.js` resolvem para `./x.ts` (o código usa extensão .js).
const WORKERS_STUB = new URL("./cloudflare-workers.ts", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { url: WORKERS_STUB, shortCircuit: true };
  }
  if (specifier.startsWith(".") && specifier.endsWith(".js")) {
    try {
      return await nextResolve(specifier.slice(0, -3) + ".ts", context);
    } catch {
      // Não há .ts equivalente: segue a resolução normal.
    }
  }
  return nextResolve(specifier, context);
}
