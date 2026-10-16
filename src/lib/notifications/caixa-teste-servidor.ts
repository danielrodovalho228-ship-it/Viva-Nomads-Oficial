import { createAdminClient } from "@/lib/supabase/admin";
import { montarRegistroEmailTeste } from "./caixa-teste";

/**
 * Se o destinatário é conta de teste (profiles.is_teste), guarda o e-mail na caixa de testes.
 * Best-effort: nunca lança e nunca atrasa o envio real. Só no servidor (service role).
 */
export async function guardarSeContaDeTeste(p: {
  evento: string;
  assunto: string;
  texto: string;
  para: string;
  usuarioId?: string;
}): Promise<boolean> {
  try {
    const admin = createAdminClient();
    if (!admin) return false;
    const q = admin.from("profiles").select("id").eq("is_teste", true).limit(1);
    const { data } = await (p.usuarioId ? q.eq("id", p.usuarioId) : q.eq("email", p.para.trim().toLowerCase()));
    const conta = data?.[0] as { id: string } | undefined;
    if (!conta) return false;
    const { error } = await admin.from("emails_teste").insert(montarRegistroEmailTeste({ ...p, usuarioId: conta.id }));
    return !error;
  } catch {
    return false;
  }
}
