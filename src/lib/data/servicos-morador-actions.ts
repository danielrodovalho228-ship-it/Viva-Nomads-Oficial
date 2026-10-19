"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import {
  proximosEstados,
  servicoAceitaPedido,
  validarPedido,
  type EstadoPedidoServico,
} from "@/lib/servicos-morador";

export interface ServicoView {
  id: string;
  nome: string;
  descricao: string;
  parceiro: string | null;
  preco: string | null;
  /** false = "Em breve": sem parceiro definido, não aceita pedido. */
  aceitaPedido: boolean;
}

export interface PedidoServicoView {
  id: string;
  servico: string;
  dataDesejada: string;
  faixa: string;
  observacao: string | null;
  prestador: string;
  preco: string | null;
  status: string;
  criadoEm: string;
}

export interface PedidoServicoAdmin extends PedidoServicoView {
  morador: string;
}

interface Resultado {
  ok: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ABERTOS = 5;

/** Catálogo do morador (tela S1): serviços pagos pelo inquilino. Leitura pública, mas só a usa quem tem contrato ativo. */
export async function catalogoServicosMorador(): Promise<ServicoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("servicos_adicionais")
    .select("id, nome, descricao, parceiro_nome, preco_texto, status")
    .eq("categoria", "assistencia_inquilino")
    .neq("status", "inativo")
    .order("nome");
  return (data ?? []).map((s) => ({
    id: String(s.id),
    nome: String(s.nome),
    descricao: String(s.descricao),
    parceiro: (s.parceiro_nome as string | null) ?? null,
    preco: (s.preco_texto as string | null) ?? null,
    aceitaPedido: servicoAceitaPedido(s as { status: string; parceiro_nome: string | null }),
  }));
}

/** O morador tem contrato ativo? (a tela e o pedido só valem para quem tem). */
export async function moradorTemContratoAtivo(): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("contratos").select("id").eq("tenant_id", user.id).eq("status", "ativo").limit(1);
  return (data ?? []).length > 0;
}

const paraView = (p: Record<string, unknown>): PedidoServicoView => ({
  id: String(p.id),
  servico: String((p.servicos_adicionais as { nome?: string } | null)?.nome ?? p.servico_id),
  dataDesejada: String(p.data_desejada),
  faixa: String(p.faixa),
  observacao: (p.observacao as string | null) ?? null,
  prestador: String(p.prestador_nome),
  preco: (p.preco_texto as string | null) ?? null,
  status: String(p.status),
  criadoEm: String(p.criado_em),
});

const COLUNAS = "id, servico_id, data_desejada, faixa, observacao, prestador_nome, preco_texto, status, criado_em, servicos_adicionais(nome)";

/** Meus pedidos (tela S3). A RLS devolve só os do próprio morador. */
export async function meusPedidosServico(): Promise<PedidoServicoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("servicos_pedidos")
    .select(COLUNAS)
    .eq("tenant_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(paraView);
}

/**
 * Pedido de serviço (tela S2). Autoridade no servidor: sessão, contrato ativo, serviço com parceiro definido,
 * data e faixa. Guarda o prestador e o preço vistos no pedido. A plataforma não cobra nem repassa dinheiro.
 */
export async function pedirServico(servicoId: string, entrada: unknown): Promise<Resultado> {
  if (typeof servicoId !== "string" || !servicoId || servicoId.length > 60) return { ok: false, error: "Serviço não encontrado." };
  const v = validarPedido(entrada);
  if (!v.ok) return { ok: false, error: v.error };

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível no momento." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para pedir um serviço." };

  const { data: contratos } = await supabase.from("contratos").select("id, property_id").eq("tenant_id", user.id).eq("status", "ativo").limit(1);
  const contrato = contratos?.[0];
  if (!contrato) return { ok: false, error: "Os serviços ficam disponíveis para quem tem uma locação ativa." };

  const { data: servico } = await admin
    .from("servicos_adicionais")
    .select("id, categoria, status, parceiro_nome, preco_texto")
    .eq("id", servicoId)
    .maybeSingle();
  if (!servico || servico.categoria !== "assistencia_inquilino") return { ok: false, error: "Serviço não encontrado." };
  if (!servicoAceitaPedido(servico as { status: string; parceiro_nome: string | null }))
    return { ok: false, error: "Este serviço ainda está em breve e não aceita pedidos." };

  const { count } = await admin
    .from("servicos_pedidos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", user.id)
    .in("status", ["enviado", "confirmado"]);
  if ((count ?? 0) >= MAX_ABERTOS) return { ok: false, error: "Você já tem pedidos em andamento. Aguarde a conclusão para pedir outro." };

  const { error } = await admin.from("servicos_pedidos").insert({
    servico_id: servico.id,
    tenant_id: user.id,
    property_id: contrato.property_id,
    data_desejada: v.pedido.data,
    faixa: v.pedido.faixa,
    observacao: v.pedido.observacao,
    prestador_nome: String(servico.parceiro_nome).trim(),
    preco_texto: (servico.preco_texto as string | null) ?? null,
  });
  if (error) return { ok: false, error: erroBancoPT(error) };
  revalidatePath("/dashboard/servicos");
  revalidatePath("/admin/servicos");
  return { ok: true };
}

/** Admin → Serviços: todos os pedidos (AAL2). Null = sem acesso. */
export async function pedidosServicoAdmin(): Promise<PedidoServicoAdmin[] | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  const { data } = await admin
    .from("servicos_pedidos")
    .select(`${COLUNAS}, profiles:tenant_id(full_name)`)
    .order("criado_em", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((p) => ({
    ...paraView(p),
    morador: String((p.profiles as { full_name?: string } | null)?.full_name ?? "Morador"),
  }));
}

/** Admin muda o estado do pedido (só avança em ordem; feito e cancelado encerram). */
export async function atualizarEstadoPedidoServico(id: string, novo: EstadoPedidoServico): Promise<Resultado> {
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Pedido não encontrado." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível no momento." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const { data: atual } = await admin.from("servicos_pedidos").select("status").eq("id", id).maybeSingle();
  if (!atual) return { ok: false, error: "Pedido não encontrado." };
  if (!proximosEstados(String(atual.status)).includes(novo)) return { ok: false, error: "Esse pedido não pode ir para este estado." };
  const { error } = await admin
    .from("servicos_pedidos")
    .update({ status: novo, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", atual.status);
  if (error) return { ok: false, error: erroBancoPT(error) };
  revalidatePath("/admin/servicos");
  revalidatePath("/dashboard/servicos");
  return { ok: true };
}
