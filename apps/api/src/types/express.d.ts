import type {} from "express";

// Augmenta o Request do Express com o campo que `requireAuth`
// (src/middleware/auth.ts) preenche depois que o JWT do Access é validado.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
