import type {} from "express";

// Augmenta o Request do Express com os campos que `requireAuth`
// (src/middleware/auth.ts) preenche depois que a sessão é validada.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userName?: string;
    }
  }
}

export {};
