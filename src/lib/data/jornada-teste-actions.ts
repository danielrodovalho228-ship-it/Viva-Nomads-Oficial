"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdminAal2 } from "@/lib/data/admin-guard";
import { ehAnuncioDeTeste } from "@/lib/data/anuncio-teste";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { COMISSAO_POR_PLANO } from "@/config/planos";

/*
  Prompt 28 — /admin › Dados de teste › "Nova jornada de teste". SÓ contas is_teste e anúncio [TESTE QA]:
  cria uma candidatura NOVA do inquilino de teste para o anúncio de teste, já aceita e com documentos fictícios, pronta
  para o Fechamento. Não apaga a candidatura nem o contrato antigos (ficam como histórico). Idempotente: se já houver
  uma jornada aberta (aceita, sem contrato ou com contrato ainda não assinado pelas duas partes), devolve o link dela.
*/

export type ResultadoJornada = { ok: true; leadId: string; link: string; reaproveitada: boolean } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function novaJornadaDeTeste(input: { tenantId: string; propertyId: string }): Promise<ResultadoJornada> {
  if (!UUID.test(String(input.tenantId)) || !UUID.test(String(input.propertyId))) return { ok: false, error: "Escolha a conta e o anúncio de teste." };
  const sessao = await createClient();
  const admin = createAdminClient();
  if (!sessao || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await exigirAdminAal2(sessao, user.id))) return { ok: false, error: "Só admin." };

  const { data: imovel } = await admin.from("properties").select("id, title, owner_id").eq("id", input.propertyId).maybeSingle();
  if (!imovel || !ehAnuncioDeTeste(imovel.title as string)) return { ok: false, error: "Use um anúncio [TESTE QA]." };
  const { data: perfis } = await admin.from("profiles").select("id, is_teste").in("id", [input.tenantId, imovel.owner_id as string]);
  const teste = new Map(((perfis ?? []) as { id: string; is_teste: boolean | null }[]).map((p) => [p.id, p.is_teste === true]));
  if (!teste.get(input.tenantId) || !teste.get(imovel.owner_id as string)) return { ok: false, error: "Só contas de teste (is_teste) — inquilino e proprietário." };
  if (input.tenantId === imovel.owner_id) return { ok: false, error: "O inquilino não pode ser o dono do anúncio." };

  // Idempotente: jornada aberta (aceita e sem contrato assinado pelas duas partes) → devolve a mesma.
  const { data: aceitas } = await admin
    .from("leads")
    .select("id, accepted_at")
    .eq("tenant_id", input.tenantId)
    .eq("property_id", input.propertyId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });
  for (const l of (aceitas ?? []) as { id: string }[]) {
    const { data: c } = await admin.from("contratos").select("assinado_proprietario_em, assinado_inquilino_em").eq("lead_id", l.id).maybeSingle();
    if (!c || !c.assinado_proprietario_em || !c.assinado_inquilino_em) {
      return { ok: true, leadId: l.id, link: `/dashboard/fechamento?c=${l.id}`, reaproveitada: true };
    }
  }

  const plano = await planoDoProprietario(admin, imovel.owner_id as string);
  const agora = new Date().toISOString();
  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      owner_id: imovel.owner_id,
      tenant_id: input.tenantId,
      property_id: input.propertyId,
      status: "accepted",
      accepted_at: agora,
      decided_by: imovel.owner_id,
      accepted_plan: plano,
      accepted_commission_rate: COMISSAO_POR_PLANO[plano] ?? COMISSAO_POR_PLANO.free,
    })
    .select("id")
    .single();
  if (error || !lead) return { ok: false, error: `Não foi possível criar a candidatura: ${error?.message ?? "erro"}` };
  // Documentos FICTÍCIOS do inquilino (a trava do fechamento só confere que foram enviados; nenhum arquivo real).
  for (const tipo of ["identidade", "vinculo"]) {
    await admin.from("documentos_inquilino").insert({
      lead_id: lead.id,
      tenant_id: input.tenantId,
      tipo,
      caminho: `${input.tenantId}/teste-qa/${randomUUID()}.pdf`,
      hash_sha256: "0".repeat(64),
    });
  }
  revalidatePath("/admin/dados-de-teste");
  return { ok: true, leadId: lead.id as string, link: `/dashboard/fechamento?c=${lead.id}`, reaproveitada: false };
}
