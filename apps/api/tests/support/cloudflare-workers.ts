// Substituto de `cloudflare:workers` nos testes. O harness preenche `env`.
export const env: Record<string, unknown> = {};

export function waitUntil(task: Promise<unknown>): void {
  void task.catch(() => {});
}
