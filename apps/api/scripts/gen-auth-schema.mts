// Gera o SQL das tabelas do Better Auth a partir da MESMA configuração usada
// em produção (src/lib/auth-options.ts), contra um SQLite em memória.
// Uso: node --experimental-strip-types scripts/gen-auth-schema.mts > out.sql
import { DatabaseSync } from "node:sqlite";
import { getMigrations } from "better-auth/db/migration";
import { buildAuthOptions } from "../src/lib/auth-options.ts";

const options = buildAuthOptions({
  database: new DatabaseSync(":memory:") as never,
  secret: "x".repeat(32),
  webUrl: "https://example.test",
  turnstileSecret: "x",
  sendOtpEmail: async () => {},
  runInBackground: () => {},
  allowOtp: async () => "ok",
  signupsAllowed: async () => true,
  purgeUserData: async () => {},
});

const { compileMigrations } = await getMigrations(options);
process.stdout.write(await compileMigrations());
