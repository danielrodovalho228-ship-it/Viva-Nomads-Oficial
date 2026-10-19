"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdminAal2 } from "@/lib/data/admin-guard";
import { PREFIXO_CARTEIRA_TESTE, planoCarteiraTeste } from "@/lib/carteira-teste";
import { TAXA_COMISSAO_PADRAO, comissaoSobreContrato } from "@/lib/cobranca/regra";

/*
  Prompt 27, item 8 — /admin › Dados de teste › "Semear carteira de teste" e "Limpar carteira de teste".
  SÓ contas is_teste. Semear: 3 imóveis "[TESTE QA] Carteira N" publicados do proprietário de teste (escondidos da
  busca pública pela marca [TESTE QA], regra do #805) + 2 contratos simulados encerrados e 1 ativo com o inquilino de
  teste, para a Análise da carteira ter ocupação e receita. Idempotente (o que já existe não é recriado). Limpar apaga
  só o que tem o prefixo da carteira de teste, nunca outro imóvel ou contrato.
*/

export type ResultadoCarteira = { ok: true; imoveisCriados: number; contratosCriados: number; imoveis: number; contratos: number } | { ok: false; error: string };
export type ResultadoLimpeza = { ok: true; imoveis: number; contratos: number } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function contexto() {
  const sessao = await createClient();
  const admin = createAdminClient();
  if (!sessao || !admin) return null;
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await exigirAdminAal2(sessao, user.id))) return null;
  return { admin, adminId: user.id };
}

async function soContasDeTeste(admin: NonNullable<ReturnType<typeof createAdminClient>>, ids: string[]): Promise<boolean> {
  const { data } = await admin.from("profiles").select("id, is_teste").in("id", ids);
  const teste = new Set(((data ?? []) as { id: string; is_teste: boolean | null }[]).filter((p) => p.is_teste === true).map((p) => p.id));
  return ids.every((id) => teste.has(id));
}

export async function semearCarteiraDeTeste(input: { ownerId: string; tenantId: string }): Promise<ResultadoCarteira> {
  if (!UUID.test(String(input.ownerId)) || !UUID.test(String(input.tenantId))) return { ok: false, error: "Escolha o proprietário e o inquilino de teste." };
  if (input.ownerId === input.tenantId) return { ok: false, error: "O inquilino não pode ser o proprietário." };
  const c = await contexto();
  if (!c) return { ok: false, error: "Só admin." };
  const { admin } = c;
  if (!(await soContasDeTeste(admin, [input.ownerId, input.tenantId]))) return { ok: false, error: "Só contas de teste (is_teste) — proprietário e inquilino." };

  const plano = planoCarteiraTeste(new Date());
  const { data: existentes } = await admin
    .from("properties")
    .select("id, title, status")
    .eq("owner_id", input.ownerId)
    .like("title", `${PREFIXO_CARTEIRA_TESTE}%`);
  const porTitulo = new Map(((existentes ?? []) as { id: string; title: string; status: string }[]).map((p) => [p.title, p]));
  let imoveisCriados = 0;
  let contratosCriados = 0;
  for (const item of plano) {
    let imovel = porTitulo.get(item.titulo);
    if (!imovel) {
      const { data, error } = await admin
        .from("properties")
        .insert({
          owner_id: input.ownerId,
          title: item.titulo,
          description: "Imóvel de teste da carteira (QA). Não aparece na busca pública e não recebe candidaturas reais.",
          property_type: "Studio",
          address: "Centro",
          city: "Uberlândia",
          state: "MG",
          bedrooms: 1,
          bathrooms: 1,
          area_m2: 40,
          max_guests: 2,
          min_period_days: 30,
          max_period_days: 180,
          monthly_price: item.valorMensal,
          status: "active",
        })
        .select("id, title, status")
        .single();
      if (error || !data) return { ok: false, error: `Não foi possível criar ${item.titulo}: ${error?.message ?? "erro"}` };
      imovel = data as { id: string; title: string; status: string };
      imoveisCriados++;
    } else if (imovel.status !== "active") {
      await admin.from("properties").update({ status: "active" }).eq("id", imovel.id);
    }
    const { data: ja } = await admin.from("contratos").select("id").eq("property_id", imovel.id).eq("tenant_id", input.tenantId).limit(1);
    if ((ja ?? []).length) continue;
    const { data: contrato, error: eC } = await admin
      .from("contratos")
      .insert({
        property_id: imovel.id,
        tenant_id: input.tenantId,
        owner_plan: "free",
        faixa: "temporada",
        prazo_total_dias: item.meses * 30,
        aluguel_mensal: item.valorMensal,
        tamanho_bloco_meses: item.meses,
        comissao_percent: TAXA_COMISSAO_PADRAO,
        comissao_valor: comissaoSobreContrato(item.valorMensal, item.meses, TAXA_COMISSAO_PADRAO),
        qtd_ocupantes: 1,
        status: item.statusContrato,
        garantia: "caucao",
        assinado_proprietario_em: `${item.inicio}T12:00:00Z`,
        assinado_inquilino_em: `${item.inicio}T12:00:00Z`,
      })
      .select("id")
      .single();
    if (eC || !contrato) return { ok: false, error: `Não foi possível criar o contrato de ${item.titulo}: ${eC?.message ?? "erro"}` };
    const { error: eB } = await admin.from("contrato_blocos").insert({
      contrato_id: contrato.id,
      numero_bloco: 1,
      inicio: item.inicio,
      fim: item.fim,
      meses: item.meses,
      valor: item.valorMensal * item.meses,
      caucao: item.valorMensal,
      status: item.statusBloco,
    });
    if (eB) return { ok: false, error: `Não foi possível criar o bloco de ${item.titulo}: ${eB.message}` };
    contratosCriados++;
  }
  revalidatePath("/admin/dados-de-teste");
  return { ok: true, imoveisCriados, contratosCriados, imoveis: plano.length, contratos: plano.length };
}

export async function limparCarteiraDeTeste(input: { ownerId: string }): Promise<ResultadoLimpeza> {
  if (!UUID.test(String(input.ownerId))) return { ok: false, error: "Escolha o proprietário de teste." };
  const c = await contexto();
  if (!c) return { ok: false, error: "Só admin." };
  const { admin } = c;
  if (!(await soContasDeTeste(admin, [input.ownerId]))) return { ok: false, error: "Só contas de teste (is_teste)." };
  const { data: imoveis } = await admin.from("properties").select("id").eq("owner_id", input.ownerId).like("title", `${PREFIXO_CARTEIRA_TESTE}%`);
  const ids = ((imoveis ?? []) as { id: string }[]).map((i) => i.id);
  if (!ids.length) return { ok: true, imoveis: 0, contratos: 0 };
  const { data: contratos } = await admin.from("contratos").select("id").in("property_id", ids);
  const cids = ((contratos ?? []) as { id: string }[]).map((x) => x.id);
  if (cids.length) {
    await admin.from("contrato_blocos").delete().in("contrato_id", cids);
    const { error } = await admin.from("contratos").delete().in("id", cids);
    if (error) return { ok: false, error: `Não foi possível apagar os contratos: ${error.message}` };
  }
  const { error: eP } = await admin.from("properties").delete().in("id", ids);
  if (eP) return { ok: false, error: `Não foi possível apagar os imóveis: ${eP.message}` };
  revalidatePath("/admin/dados-de-teste");
  return { ok: true, imoveis: ids.length, contratos: cids.length };
}
