import nextConfig from "eslint-config-next";

// eslint-config-next@16 já exporta um flat config nativo (array de objetos)
// — nada de FlatCompat/`extends` de string aqui, que é só para configs no
// formato antigo do .eslintrc e quebra com este pacote (config-validator
// tenta revalidar um plugin flat-config, que tem referência circular, contra
// o schema antigo e estoura ao formatar o próprio erro).
const eslintConfig = [{ ignores: ["next-env.d.ts", ".next/**"] }, ...nextConfig];

export default eslintConfig;
