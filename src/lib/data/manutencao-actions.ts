"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { camposAoAvancar, linhaParaOrdem, STATUS_CONTRATO_COM_MANUTENCAO, type LinhaOrdem } from "@/lib/manutencao-solicitacoes";
import type { ServiceOrder, SOStatus } from "@/lib/service-orders";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ContratoManutencao {
  id: string;
  titulo: string;
}

export interface MinhasSolicitacoes {
  /** null = sem sessão ou sem banco (demonstração): a tela usa os exemplos. */
  comoInquilino: ServiceOrder[];
  comoDono: ServiceOrder[];
  contratos: ContratoManutencao[];
}

/**
 * Chamados REAIS da pessoa: os que ela abriu (inquilino) e os dos seus imóveis
 * (dono). A leitura passa pelo RLS (service_orders: só as partes). Contratos
 * ativos = onde a manutenção pode ser pedida.
 */
export async function minhasSolicitacoes(): Promise<MinhasSolicitacoes | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const colunas = "id, category, priority, description, status, opened_at, first_response_at, resolved_at, tenant_id, owner_id, properties(title)";
  const { data: linhas } = await supabase
    .from("service_orders")
    .select(colunas)
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
    .order("opened_at", { ascending: false })
    .limit(200);
  const todas = (linhas ?? []) as unknown as (LinhaOrdem & { tenant_id: string; owner_id: string })[];

  // Nome do inquilino só para o dono daquele imóvel (o contrato ativo já foi aceito).
  const nomes = new Map<string, string>();
  const idsInquilino = [...new Set(todas.filter((l) => l.owner_id === user.id && l.tenant_id !== user.id).map((l) => l.tenant_id))];
  const admin = createAdminClient();
  if (admin && idsInquilino.length) {
    const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", idsInquilino);
    for (const p of perfis ?? []) if (p.full_name) nomes.set(p.id as string, p.full_name as string);
  }

  const comoInquilino = todas.filter((l) => l.tenant_id === user.id).map((l) => linhaParaOrdem(l));
  const comoDono = todas
    .filter((l) => l.owner_id === user.id)
    .map((l) => linhaParaOrdem({ ...l, tenant_name: nomes.get(l.tenant_id) ?? null }));

  let contratos: ContratoManutencao[] = [];
  if (admin) {
    const { data: cts } = await admin
      .from("contratos")
      .select("id, properties(title)")
      .eq("tenant_id", user.id)
      .in("status", [...STATUS_CONTRATO_COM_MANUTENCAO])
      .limit(20);
    contratos = (cts ?? []).map((c) => ({ id: c.id as string, titulo: (c.properties as unknown as { title?: string } | null)?.title?.trim() || "Meu imóvel" }));
  }
  return { comoInquilino, comoDono, contratos };
}

/** O dono do imóvel avança o chamado (Aberto → Visto → Em andamento → Resolvido). Só o dono, validado aqui. */
export async function avancarSolicitacao(id: string): Promise<{ ok: true; ordem: ServiceOrder } | { ok: false; error: string }> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "Solicitação inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Indisponível no momento." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };

  const { data: so } = await supabase
    .from("service_orders")
    .select("id, status, first_response_at, owner_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!so) return { ok: false, error: "Solicitação não encontrada." };
  const campos = camposAoAvancar(so.status as SOStatus, (so.first_response_at as string | null) ?? null, new Date());
  if (!campos) return { ok: false, error: "Esta solicitação já foi resolvida." };

  const { data: nova, error } = await supabase
    .from("service_orders")
    .update(campos)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id, category, priority, description, status, opened_at, first_response_at, resolved_at, properties(title)")
    .single();
  if (error || !nova) {
    console.error("[avancarSolicitacao]", error?.code, error?.message);
    return { ok: false, error: "Não foi possível atualizar agora. Tente de novo." };
  }
  revalidatePath("/dashboard/solicitacoes");
  return { ok: true, ordem: linhaParaOrdem(nova as unknown as LinhaOrdem) };
}
