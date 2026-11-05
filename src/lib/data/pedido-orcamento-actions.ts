"use server";

/*
  E440 (orçamento numerado, Pista B): o número do pedido do morador (VN-PD-…) e do orçamento (ORC-…) na tela do contrato,
  e a ação "Pedir orçamento" do morador no pedido aceito. Tudo pelo cliente da SESSÃO (RLS: só as partes leem).
*/
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/data/actions";
import { situacaoCandidatura } from "@/lib/candidaturas/status";
import {
  MSG_PEDIDO_ORCAMENTO_ENVIADO,
  MSG_PEDIDO_ORCAMENTO_INDISPONIVEL,
  numeroPublicoPedido,
  podePedirOrcamento,
  textoPedirOrcamento,
} from "@/lib/pedido-ref";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Orçamento que ainda espera resposta (o dono não manda outro enquanto este está aberto). */
const ORCAMENTO_ABERTO = ["enviada", "vista", "contraproposta"];
/** Orçamento que virou (ou está virando) contrato — o que a tela do contrato mostra. */
const ORCAMENTO_DO_CONTRATO = ["aceita", "em_contrato", "contrato_assinado"];

/** Números do contrato para a tela: pedido do morador e o orçamento aceito desse pedido (null quando não há). */
export async function numerosDoContrato(contratoId: string): Promise<{ pedido: string | null; orcamento: string | null } | null> {
  if (!UUID_RE.test(String(contratoId))) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  // E440: o orçamento de origem gravado no contrato (0299). Sem a coluna (0299 ainda não aplicada), a leitura antiga.
  let { data: c, error } = await supabase.from("contratos").select("lead_id, proposta_id, propostas!contratos_proposta_id_fkey(numero)").eq("id", contratoId).maybeSingle();
  if (error && (error.code === "42703" || error.code === "PGRST200")) ({ data: c, error } = await supabase.from("contratos").select("lead_id").eq("id", contratoId).maybeSingle());
  if (error) throw new Error("Não foi possível ler os números do contrato agora.");
  const linha = c as { lead_id?: string | null; propostas?: { numero?: string | null } | { numero?: string | null }[] | null } | null;
  const leadId = linha?.lead_id ?? null;
  const vinculada = Array.isArray(linha?.propostas) ? linha?.propostas[0]?.numero : linha?.propostas?.numero;
  if (vinculada) return { pedido: numeroPublicoPedido(leadId), orcamento: vinculada };
  if (!leadId) return { pedido: null, orcamento: null };
  const { data: p, error: eP } = await supabase
    .from("propostas")
    .select("numero, status, criada_em")
    .eq("lead_id", leadId)
    .in("status", ORCAMENTO_DO_CONTRATO)
    .order("criada_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eP) throw new Error("Não foi possível ler os números do contrato agora.");
  return { pedido: numeroPublicoPedido(leadId), orcamento: (p as { numero?: string } | null)?.numero ?? null };
}

/** "Pedir orçamento": o morador, com o pedido aceito e sem orçamento aberto nem contrato, pede ao dono pelo chat. */
export async function pedirOrcamento(leadId: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!UUID_RE.test(String(leadId))) return { ok: false, mensagem: MSG_PEDIDO_ORCAMENTO_INDISPONIVEL };
  const supabase = await createClient();
  if (!supabase) return { ok: false, mensagem: MSG_PEDIDO_ORCAMENTO_INDISPONIVEL };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensagem: "Entre na sua conta para pedir o orçamento." };
  const { data: lead, error } = await supabase
    .from("leads")
    .select("id, status, owner_id, property_id, tenant_id")
    .eq("id", leadId)
    .eq("tenant_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, mensagem: "Não foi possível conferir o pedido agora. Tente de novo." };
  const l = lead as { id: string; status: string; owner_id: string; property_id: string } | null;
  if (!l) return { ok: false, mensagem: MSG_PEDIDO_ORCAMENTO_INDISPONIVEL };
  const [aberto, contrato] = await Promise.all([
    supabase.from("propostas").select("id", { count: "exact", head: true }).eq("lead_id", l.id).in("status", ORCAMENTO_ABERTO),
    supabase.from("contratos").select("id", { count: "exact", head: true }).eq("lead_id", l.id),
  ]);
  // Leitura que falha nunca vira "pode pedir" (não manda pedido repetido nem pedido com contrato já feito).
  if (aberto.error || contrato.error) return { ok: false, mensagem: "Não foi possível conferir o pedido agora. Tente de novo." };
  const pode = podePedirOrcamento({
    situacao: situacaoCandidatura(l.status).chave,
    temOrcamentoAberto: (aberto.count ?? 0) > 0,
    temContrato: (contrato.count ?? 0) > 0,
  });
  if (!pode) return { ok: false, mensagem: MSG_PEDIDO_ORCAMENTO_INDISPONIVEL };
  const numero = numeroPublicoPedido(l.id)!;
  const r = await sendMessage({ receiverId: l.owner_id, propertyId: l.property_id, body: textoPedirOrcamento(numero) });
  if (!r.ok) return { ok: false, mensagem: r.error ?? "Não foi possível enviar agora. Tente de novo." };
  return { ok: true, mensagem: MSG_PEDIDO_ORCAMENTO_ENVIADO };
}
