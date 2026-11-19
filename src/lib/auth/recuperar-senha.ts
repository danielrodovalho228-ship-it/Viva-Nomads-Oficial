import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { emailRecuperacaoComCodigo } from "@/lib/notifications/templates-supabase";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * E917 (opção A): a conta é de TESTE? Só profiles.is_teste decide. Conta real (ou e-mail sem conta) → false, e a
 * recuperação segue exatamente como hoje (Supabase Auth, link por e-mail, nada na caixa de teste).
 */
export async function contaDeTeste(admin: Admin, email: string): Promise<{ id: string } | null> {
  const { data } = await admin.from("profiles").select("id").eq("email", email).eq("is_teste", true).limit(1);
  const linha = (data ?? [])[0] as { id: string } | undefined;
  return linha ? { id: linha.id } : null;
}

/**
 * E917: o código de recuperação (o OTP do tipo recovery do próprio Supabase: mesma validade, uso único) sai pelo
 * NOSSO envio — e por isso cai na caixa de teste. O e-mail não leva link: só o código (a E163 fica intacta).
 */
export async function enviarRecuperacaoPorCodigo(admin: Admin, email: string, usuarioId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  const codigo = data?.properties?.email_otp;
  if (error || !codigo) {
    if (error) console.error("[enviarRecuperacaoPorCodigo]", error.status ?? "", error.message);
    return null;
  }
  const { assunto, html } = emailRecuperacaoComCodigo(codigo);
  const r = await sendEmail({ to: email, subject: assunto, html, evento: "recuperar_senha", usuarioId }).catch(() => null);
  // E917 (prova de 19/11): o código volta para a rota, que o mostra na tela da conta de teste.
  return !!r && !r.error ? codigo : null;
}
