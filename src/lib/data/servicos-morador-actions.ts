"use server";

import { revalidatePath } from "next/cache";
import { recusaObservador } from "@/lib/qa/observador";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { proximosEstados, type EstadoPedidoServico } from "@/lib/servicos-morador";

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
  const { data, error } = await admin
    .from("servicos_pedidos")
    // E470: sem embed de profiles — tenant_id aponta para auth.users, e o PostgREST não acha a relação (PGRST200).
    .select(`${COLUNAS}, tenant_id`)
    .order("criado_em", { ascending: false })
    .limit(200);
  // Achado 33: erro de leitura sobe e cai no aviso do admin ("Tentar de novo"), não em "Nenhum pedido… ainda".
  if (error) throw new Error("Não foi possível ler os pedidos de serviço.");
  const linhas = (data ?? []) as unknown as Record<string, unknown>[];
  const ids = [...new Set(linhas.map((p) => String(p.tenant_id ?? "")).filter(Boolean))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const pf of (perfis ?? []) as { id: string; full_name: string | null }[]) if (pf.full_name) nomes.set(pf.id, pf.full_name);
  }
  return linhas.map((p) => ({
    ...paraView(p),
    morador: nomes.get(String(p.tenant_id)) ?? "Morador",
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
  // E477: a conta observadora da QA só lê o pedido de serviço do morador.
  const recusaQa = await recusaObservador(user.id);
  if (recusaQa) return { ok: false, error: recusaQa };
  const { data: atual, error: erroAtual } = await admin.from("servicos_pedidos").select("status").eq("id", id).maybeSingle();
  if (erroAtual) return { ok: false, error: "Não foi possível ler o pedido agora. Tente de novo." };
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
