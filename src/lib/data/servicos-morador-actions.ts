"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { consumirLimite } from "@/lib/limites";
import { fotoDoServico } from "@/config/fotos-servicos";
import { proximosEstados, servicoAceitaPedido, servicosDoInquilino, type EstadoPedidoServico } from "@/lib/servicos-morador";

export interface ServicoView {
  id: string;
  nome: string;
  /** Linha curta do cartão. */
  resumo: string;
  descricao: string;
  /** Foto da categoria (4:3). Sem foto, o cartão não aparece. */
  foto: { src: string; alt: string };
  /** false = "Em breve": sem parceiro aprovado (ou o pedido do 31b ainda não está no ar). */
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

/**
 * Catálogo do morador (tela S1): só as categorias pagas pelo INQUILINO (o Plano de manutenção do dono fica fora) e só
 * as que já têm foto — cartão sem foto não aparece (nada de ícone no lugar).
 */
export async function catalogoServicosMorador(): Promise<ServicoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("servicos_adicionais")
    .select("id, nome, resumo, descricao, quem_paga, parceiro_nome, status")
    .order("nome");
  const lista = servicosDoInquilino((data ?? []) as { id: string; nome: string; resumo: string | null; descricao: string; quem_paga: string; parceiro_nome: string | null; status: string }[]);
  return lista.flatMap((s) => {
    const foto = fotoDoServico(String(s.id));
    if (!foto) return [];
    return [
      {
        id: String(s.id),
        nome: String(s.nome),
        resumo: String(s.resumo ?? s.descricao),
        descricao: String(s.descricao),
        foto,
        aceitaPedido: servicoAceitaPedido(s),
      },
    ];
  });
}

/** "Avise-me quando estiver disponível" (cartão "Em breve"). Quem pede vem da sessão; uma linha por pessoa e categoria. */
export async function avisarServicoDisponivel(servicoId: string): Promise<Resultado> {
  if (typeof servicoId !== "string" || !/^[a-z0-9_]{2,60}$/.test(servicoId)) return { ok: false, error: "Serviço não encontrado." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Indisponível no modo demonstração." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para receber o aviso." };
  if (!(await consumirLimite(`aviso-servico:${user.id}`, 20, 3600))) return { ok: false, error: "Muitas tentativas. Tente de novo mais tarde." };
  const { data: servico } = await supabase.from("servicos_adicionais").select("id, quem_paga").eq("id", servicoId).maybeSingle();
  if (!servico || servico.quem_paga !== "inquilino") return { ok: false, error: "Serviço não encontrado." };
  const { error } = await supabase
    .from("interesse_servico")
    .upsert({ user_id: user.id, servico_id: servicoId }, { onConflict: "user_id,servico_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Não foi possível registrar agora. Tente novamente." };
  return { ok: true };
}

/** O contrato ativo do morador (a tela só vale para quem tem; contrato e imóvel vão pré-preenchidos no pedido do 31b). */
export async function contratoAtivoDoMorador(): Promise<{ contratoId: string; propertyId: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("contratos").select("id, property_id").eq("tenant_id", user.id).eq("status", "ativo").limit(1);
  const c = (data ?? [])[0] as { id: string; property_id: string } | undefined;
  return c ? { contratoId: c.id, propertyId: c.property_id } : null;
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
