import { createAdminClient } from "@/lib/supabase/admin";
import { guardarNaCaixaTeste, type ClienteCaixaTeste, type EmailParaCaixa } from "./caixa-teste";

/**
 * Se o destinatário é conta de teste (profiles.is_teste), guarda o e-mail na caixa de testes.
 * Best-effort: nunca lança e nunca atrasa o envio real. Só no servidor (service role).
 * Chamada SÓ por sendEmail (notifications/email.ts), depois do envio aceito: todo e-mail que sai passa por lá.
 */
export async function guardarSeContaDeTeste(p: EmailParaCaixa): Promise<boolean> {
  try {
    const admin = createAdminClient();
    if (!admin) return false;
    return await guardarNaCaixaTeste(admin as unknown as ClienteCaixaTeste, p);
  } catch {
    return false;
  }
}
