import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { visitaConfirmada, type VisitaDoAvaliador } from "./visitas-confirmadas";

/**
 * E1103: as visitas CONFIRMADAS do avaliador da sessão (a mesma fonte da tela do pedido: vistoria_pedidos), para a
 * Agenda do painel do parceiro. Quem não é avaliador credenciado recebe a lista vazia. `falhou` = uma leitura falhou:
 * a Agenda avisa em vez de mostrar "nenhum horário" (uma visita marcada não pode sumir calada).
 */
export async function visitasConfirmadasDoAvaliador(): Promise<{ visitas: VisitaDoAvaliador[]; falhou: boolean }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { visitas: [], falhou: false };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { visitas: [], falhou: false };
  const { data: parc, error: erroParc } = await admin.from("parceiros").select("id").eq("user_id", user.id).maybeSingle();
  if (erroParc) return { visitas: [], falhou: true };
  // O credenciamento liga-se ao parceiro ou, antes da aprovação, à pessoa (como na página do avaliador).
  const { data: creds, error: erroCred } = await admin
    .from("avaliadores_credenciamento")
    .select("id")
    .or(parc ? `parceiro_id.eq.${parc.id},user_id.eq.${user.id}` : `user_id.eq.${user.id}`);
  if (erroCred) return { visitas: [], falhou: true };
  const ids = ((creds ?? []) as { id: string }[]).map((c) => c.id);
  if (!ids.length) return { visitas: [], falhou: false };
  const { data, error } = await admin
    .from("vistoria_pedidos")
    .select("id, status, agendado_para, cidade")
    .in("avaliador_id", ids)
    .eq("status", "agendado")
    .not("agendado_para", "is", null)
    .order("agendado_para", { ascending: true });
  if (error) return { visitas: [], falhou: true };
  return { visitas: ((data ?? []) as VisitaDoAvaliador[]).filter(visitaConfirmada), falhou: false };
}
