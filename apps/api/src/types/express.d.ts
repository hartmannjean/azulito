import type {} from "express";

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
