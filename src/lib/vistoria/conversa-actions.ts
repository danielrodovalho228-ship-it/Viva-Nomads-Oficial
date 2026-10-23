"use server";
/*
  Prompt 62-A, Parte 1, item 5 — a visita de avaliação no topo da conversa da estadia, para o MORADOR do imóvel ocupado:
  "Concordo com a visita em [data/hora]" (a mesma ação da página /dashboard/avaliacao-imovel/[id]) ou "Prefiro outro
  horário" (a mensagem vai pela própria conversa). Com VISTORIA_ATIVA desligada, nada aparece.
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vistoriaAtiva } from "@/lib/vistoria/chave";
import { quandoVisita } from "@/lib/vistoria/telas-exibicao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AvaliacaoNaConversa = { pedidoId: string; quando: string; confirmada: boolean };

export async function avaliacaoNaConversa(propertyId: string): Promise<AvaliacaoNaConversa | null> {
  if (!UUID.test(String(propertyId))) return null;
  if (!(await vistoriaAtiva())) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await admin
    .from("vistoria_pedidos")
    .select("id, agendado_para, concordancia_em, status")
    .eq("property_id", propertyId)
    .eq("morador_id", user.id)
    .eq("ocupado", true)
    .in("status", ["designado", "agendado"])
    .not("agendado_para", "is", null)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.agendado_para) return null;
  return { pedidoId: data.id as string, quando: quandoVisita(data.agendado_para as string), confirmada: !!data.concordancia_em };
}
