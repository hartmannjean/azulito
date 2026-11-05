import { env } from "cloudflare:workers";

const SUBJECTS: Record<string, string> = {
  "sign-in": "Seu código de acesso ao Azulito",
  "email-verification": "Confirme seu e-mail no Azulito",
  "forget-password": "Seu código de acesso ao Azulito",
  "change-email": "Confirme seu novo e-mail no Azulito",
};

/**
 * Envia o código de login pela Resend. Só o e-mail do usuário e o código
 * trafegam por aqui — nunca dado financeiro. A chave é um secret do Worker com
 * permissão apenas de envio. Falhas são logadas SEM o código nem o e-mail e
 * não propagam: a resposta do endpoint não pode revelar se o envio funcionou.
 */
export async function sendOtpEmail(to: string, otp: string, type: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    // Só com DEV_LOG_OTP (definida apenas no .dev.vars local) o código vai
    // para o log, para testar o fluxo sem enviar e-mail. Nunca em produção.
    if (env.DEV_LOG_OTP === "1") console.log(`[dev] código de login: ${otp}`);
    else console.error("RESEND_API_KEY ausente: e-mail de login não enviado.");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject: SUBJECTS[type] ?? SUBJECTS["sign-in"],
        text: `Seu código do Azulito: ${otp}\n\nEle vale por 5 minutos e só funciona uma vez. Se não foi você, ignore este e-mail.`,
        html: `<p>Seu código do Azulito:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${otp}</p><p>Ele vale por 5 minutos e só funciona uma vez. Se não foi você, ignore este e-mail.</p>`,
      }),
    });
    if (!response.ok) console.error("Resend recusou o envio, status", response.status);
  } catch {
    console.error("Falha de rede ao chamar a Resend.");
  }
}
