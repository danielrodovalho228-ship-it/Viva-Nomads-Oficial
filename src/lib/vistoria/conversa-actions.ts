"use server";
/*
  Prompt 62-A, Parte 1, item 5 — a visita de avaliação no topo da conversa da estadia, para o MORADOR do imóvel ocupado:
  "Concordo com a visita em [data/hora]" (a mesma ação da página /dashboard/avaliacao-imovel/[id]) ou "Prefiro outro
  horário" (a mensagem vai pela própria conversa). Com VISTORIA_ATIVA desligada, nada aparece.
  E1171 (ORDEM-DUET-746): a chave é a do PEDIDO (a sessão do morador, ou o dono do pedido no piloto).
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vistoriaAtivaParaOMorador } from "@/lib/vistoria/chave";
import { quandoVisita } from "@/lib/vistoria/telas-exibicao";
import { concordanciaRecusada } from "@/lib/vistoria/concordancia";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** E1173: `recusada` — o morador disse "Não concordo" e ainda não há data nova (aí `quando` vem vazio). */
export type AvaliacaoNaConversa = { pedidoId: string; quando: string; confirmada: boolean; recusada: boolean };

export async function avaliacaoNaConversa(propertyId: string): Promise<AvaliacaoNaConversa | null> {
  if (!UUID.test(String(propertyId))) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await admin
    .from("vistoria_pedidos")
    .select("id, owner_id, agendado_para, concordancia_em, concordancia_pedida_em, ocupado, status")
    .eq("property_id", propertyId)
    .eq("morador_id", user.id)
    .eq("ocupado", true)
    .in("status", ["designado", "agendado"])
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const recusada = concordanciaRecusada({ status: data.status as string, ocupado: data.ocupado === true, agendadoPara: data.agendado_para as string | null, concordanciaPedidaEm: data.concordancia_pedida_em as string | null, concordanciaEm: data.concordancia_em as string | null });
  // Sem data só há o que mostrar depois de uma recusa (antes da primeira proposta o cartão não aparece).
  if (!data.agendado_para && !recusada) return null;
  if (!(await vistoriaAtivaParaOMorador(admin, data.owner_id as string | null))) return null;
  return { pedidoId: data.id as string, quando: data.agendado_para ? quandoVisita(data.agendado_para as string) : "", confirmada: !!data.concordancia_em, recusada };
}
