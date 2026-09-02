import type {} from "express";

// `express.json({ verify })` (src/app.ts) tipa o `req` do callback como o
// `http.IncomingMessage` cru do Node, não como `express.Request` — por isso
// `rawBody` é augmentado ali, não no namespace Express abaixo.
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

// Augmenta o Request do Express com os campos que `requireAuth`
// (src/middleware/auth.ts) preenche depois que o token é validado.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      accessToken?: string;
    }
  }
}

export {};
