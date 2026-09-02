import { z } from "zod";

// Limite de tamanho evita ataques de "long password DoS" contra o hashing
// de senha e também corta payloads absurdos antes de qualquer processamento.
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(8).max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export type AuthActionState = { error: string | null };
