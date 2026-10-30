import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { comSugestoesDesligadas, conferirDescadastro } from "@/lib/notifications/proativos";

/*
  E264-B — descadastro dos e-mails proativos (categoria "Sugestões e novidades") pelo link assinado do e-mail, SEM
  login: a página /avisos/desligar (com confirmação) e o one-click do provedor (POST /api/avisos/desligar, RFC 8058).
  Desliga SÓ essa categoria (as outras e as decisões continuam) e descarta o que estava na fila da pessoa.
*/

/** true = desligou (ou já estava desligada). false = link inválido ou falha. */
export async function desligarSugestoesPorLink(usuarioId: string, assinatura: string): Promise<boolean> {
  if (!conferirDescadastro(usuarioId, assinatura, process.env.CRON_SECRET ?? "")) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("profiles").select("notif_categorias_desligadas").eq("id", usuarioId).maybeSingle();
  if (error || !data) return false;
  const desligadas = comSugestoesDesligadas((data as { notif_categorias_desligadas?: string[] | null }).notif_categorias_desligadas);
  const { error: e2 } = await admin.from("profiles").update({ notif_categorias_desligadas: desligadas }).eq("id", usuarioId);
  if (e2) return false;
  await admin
    .from("emails_proativos")
    .update({ descartado_em: new Date().toISOString(), motivo_descarte: "descadastro" })
    .eq("usuario_id", usuarioId)
    .is("enviado_em", null)
    .is("descartado_em", null);
  return true;
}
