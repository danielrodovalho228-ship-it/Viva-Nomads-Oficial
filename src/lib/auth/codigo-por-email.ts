import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { emailComCodigo } from "@/lib/notifications/templates-supabase";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * 49-C1 — manda o código de acesso por um e-mail nosso (o mesmo modelo do Supabase, sem link). Usado pelo atendimento
 * da Viva (não passa pelo CAPTCHA do Supabase) e pelo laboratório. O código vem do Supabase (generateLink → email_otp)
 * e entra pela mesma tela "Digite o código". O limite de envios fica com quem chama.
 */
export async function enviarCodigoPorEmail(admin: Admin, email: string, novo: boolean, usuarioId?: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const codigo = data?.properties?.email_otp;
  if (error || !codigo) {
    if (error) console.error("[enviarCodigoPorEmail]", error.status ?? "", error.message);
    return false;
  }
  const { assunto, html } = emailComCodigo(novo, codigo);
  const r = await sendEmail({ to: email, subject: assunto, html, evento: "codigo_acesso", usuarioId }).catch(() => null);
  return !!r && !r.error;
}
