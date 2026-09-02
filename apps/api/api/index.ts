import { createApp } from "../src/app.js";

/**
 * Entry point da Vercel: qualquer arquivo em /api é implantado como uma
 * função serverless. `vercel.json` reescreve todas as rotas pra cá, e o
 * app Express (uma função `(req, res) => void`) é compatível com a
 * assinatura que o runtime Node da Vercel espera.
 */
export default createApp();
