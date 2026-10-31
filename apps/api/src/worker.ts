import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.js";

const PORT = 8080;

createApp().listen(PORT);

const http = httpServerHandler({ port: PORT });

export default {
  fetch: http.fetch,
  // Substitui o Vercel Cron: reaproveita a rota /pluggy/sync (autenticada por
  // CRON_SECRET) chamando o próprio app em vez de duplicar a lógica.
  async scheduled(_controller: unknown, env: { CRON_SECRET?: string }) {
    const res = await http.fetch(
      new Request("http://internal/pluggy/sync", {
        headers: { Authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
      }),
    );
    if (!res.ok) console.error(`pluggy sync falhou: ${res.status}`);
  },
};
