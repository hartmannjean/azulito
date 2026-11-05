import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Scripts e testes rodam no Node (não no Workers): precisam dos globais dele.
const nodeGlobals = Object.fromEntries(
  ["console", "process", "URL", "fetch", "Request", "Response", "Headers", "setTimeout", "TextDecoder", "crypto"].map(
    (name) => [name, "readonly"],
  ),
);

export default tseslint.config(
  // .wrangler e .mutation-tmp são saídas geradas (código empacotado / cópia temporária).
  { ignores: ["dist/**", ".wrangler/**", ".mutation-tmp/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["scripts/**", "tests/**"],
    languageOptions: { globals: nodeGlobals },
    rules: {
      // Respostas HTTP de teste têm formato livre; o que importa é o conteúdo.
      "@typescript-eslint/no-explicit-any": "off",
      // O script de mutação remove códigos de cor ANSI da saída do teste.
      "no-control-regex": "off",
    },
  },
);
