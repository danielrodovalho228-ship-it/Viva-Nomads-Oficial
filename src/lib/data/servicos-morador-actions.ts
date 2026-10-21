"use server";

import { revalidatePath } from "next/cache";
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
