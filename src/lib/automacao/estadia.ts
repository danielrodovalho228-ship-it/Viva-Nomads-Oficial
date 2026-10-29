import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarParceiros } from "@/lib/data/parceiros-publico";
import { hojeEmBrasilia } from "@/lib/checkin";
import { momentoDaSugestao, type CategoriaVinculo, type Gatilho } from "./pedidos-do-evento";
import { chaveAntiga } from "./remarcacao";

/*
  Os dois cartões do Prompt 38 na página da estadia. Quem chama já conferiu que a pessoa é parte do contrato
  (carregarEstadia); aqui só se lê o que cada papel vê.
*/

export interface PedidoDepoisDaSaida {
  id: string;
  categoria: string;
  gatilho: Gatilho;
  parceiro: string;
  status: string;
  aguardandoDono: boolean;
  semResposta: boolean;
}

export interface DepoisDaSaida {
  pedidos: PedidoDepoisDaSaida[];
  fixos: { categoria: CategoriaVinculo; parceiro: string; status: string; modo: string }[];
}

/** Dono: os pedidos automáticos deste contrato (o último de cada chave) e os parceiros fixos do imóvel. */
export async function depoisDaSaida(contratoId: string, propertyId: string): Promise<DepoisDaSaida> {
  const admin = createAdminClient();
  if (!admin) return { pedidos: [], fixos: [] };
  const [{ data: ps }, { data: vs }] = await Promise.all([
    admin
      .from("parceiro_pedidos")
      .select("id, categoria, gatilho, status, aguardando_dono, sem_resposta_avisado_em, chave_automacao, criado_em, parceiros(nome_publico)")
      .eq("contrato_id", contratoId)
      .eq("origem", "automatico")
      .order("criado_em", { ascending: false })
      .limit(20),
    admin.from("imovel_parceiros").select("categoria, status, modo, parceiros(nome_publico)").eq("property_id", propertyId).in("status", ["pendente", "ativo"]),
  ]);
  type LP = { id: string; categoria: string; gatilho: Gatilho; status: string; aguardando_dono: boolean; sem_resposta_avisado_em: string | null; chave_automacao: string; parceiros: { nome_publico: string } | null };
  // Troca de parceiro (":troca:") e remarcação para longe (":remarcado:", E213-B): o pedido que saiu da frente some.
  const pedidos = ((ps ?? []) as unknown as LP[])
    .filter((p) => !chaveAntiga(p.chave_automacao))
    .map((p) => ({
      id: p.id,
      categoria: p.categoria,
      gatilho: p.gatilho,
      parceiro: p.parceiros?.nome_publico ?? "Parceiro",
      status: p.status,
      aguardandoDono: p.aguardando_dono && p.status === "solicitado",
      semResposta: !!p.sem_resposta_avisado_em && p.status === "solicitado",
    }));
  const fixos = ((vs ?? []) as unknown as { categoria: CategoriaVinculo; status: string; modo: string; parceiros: { nome_publico: string } | null }[]).map((v) => ({
    categoria: v.categoria,
    parceiro: v.parceiros?.nome_publico ?? "Parceiro",
    status: v.status,
    modo: v.modo,
  }));
  return { pedidos, fixos };
}

export interface SugestaoMorador {
  momento: "entrada" | "saida";
  parceiros: { slug: string; nome: string; categoria: string }[];
}

/** Morador: só nos 7 dias antes da entrada e da saída, parceiros da cidade (mudança; na entrada, também limpeza). */
export async function sugestaoMorador(periodo: { inicio: string | null; fim: string | null }, cidade: string | null, agora = new Date()): Promise<SugestaoMorador | null> {
  const momento = momentoDaSugestao(periodo, hojeEmBrasilia(agora));
  if (!momento) return null;
  const categorias = momento === "entrada" ? ["mudanca", "limpeza"] : ["mudanca"];
  const listas = await Promise.all(categorias.map((c) => buscarParceiros({ categoria: c, cidade }).then((r) => r.lista.slice(0, 3).map((p) => ({ slug: p.slug, nome: p.nomePublico, categoria: c })))));
  return { momento, parceiros: listas.flat() };
}
