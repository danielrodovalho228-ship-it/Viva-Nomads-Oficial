"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdminAal2 } from "@/lib/data/admin-guard";
import { ehAnuncioDeTeste } from "@/lib/data/anuncio-teste";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { COMISSAO_POR_PLANO } from "@/config/planos";
import { logModeracao } from "@/lib/data/moderacao-log";
import { ACOES_JORNADA } from "@/lib/jornada-teste";

/*
  Prompt 28 — /admin › Dados de teste › "Nova jornada de teste". SÓ contas is_teste e anúncio [TESTE QA]:
  cria uma candidatura NOVA do inquilino de teste para o anúncio de teste, já aceita e com documentos fictícios, pronta
  para o Fechamento. Não apaga a candidatura nem o contrato antigos (ficam como histórico). Idempotente: se já houver
  uma jornada aberta (aceita, sem contrato ou com contrato ainda não assinado pelas duas partes), devolve o link dela.
*/

/** Os dados que a tela mostra depois do clique (adendo ao prompt 28): nunca termina sem texto. */
export interface DetalheJornada {
  leadId: string;
  /** Número curto da candidatura (os 8 primeiros caracteres do id), para conferir nas telas. */
  numero: string;
  anuncio: string;
  inquilino: string;
  /** Quando a candidatura foi aceita (ISO). */
  aceitaEm: string | null;
  links: { fechamento: string; candidaturas: string; leads: string };
}

export type ResultadoJornada =
  | ({ ok: true; reaproveitada: false; link: string } & DetalheJornada)
  | ({ ok: true; reaproveitada: true; link: string; motivo: string } & DetalheJornada)
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


function detalhe(leadId: string, anuncio: string, inquilino: string, aceitaEm: string | null): DetalheJornada {
  return {
    leadId,
    numero: leadId.slice(0, 8),
    anuncio,
    inquilino,
    aceitaEm,
    links: { fechamento: `/dashboard/fechamento?c=${leadId}`, candidaturas: "/dashboard/candidaturas", leads: "/dashboard/leads" },
  };
}

export async function novaJornadaDeTeste(input: { tenantId: string; propertyId: string }): Promise<ResultadoJornada> {
  if (!UUID.test(String(input.tenantId)) || !UUID.test(String(input.propertyId))) return { ok: false, error: "Escolha a conta e o anúncio de teste." };
  const sessao = await createClient();
  const admin = createAdminClient();
  if (!sessao || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await exigirAdminAal2(sessao, user.id))) return { ok: false, error: "Só admin." };
  const r = await jornada(admin, input);
  // Log na página (moderacao_log): criada / reaproveitada / erro, com a mensagem.
  if (r.ok) {
    await logModeracao(
      admin,
      user.id,
      r.reaproveitada ? ACOES_JORNADA.reaproveitada : ACOES_JORNADA.criada,
      "lead",
      r.leadId,
      `${r.anuncio} · ${r.inquilino}${r.reaproveitada ? ` · ${r.motivo}` : ""}`.slice(0, 500),
    );
  } else {
    await logModeracao(admin, user.id, ACOES_JORNADA.erro, "property", input.propertyId, r.error.slice(0, 500));
  }
  revalidatePath("/admin/dados-de-teste");
  return r;
}

async function jornada(admin: NonNullable<ReturnType<typeof createAdminClient>>, input: { tenantId: string; propertyId: string }): Promise<ResultadoJornada> {
  const { data: imovel } = await admin.from("properties").select("id, title, owner_id").eq("id", input.propertyId).maybeSingle();
  if (!imovel || !ehAnuncioDeTeste(imovel.title as string)) return { ok: false, error: "Use um anúncio [TESTE QA]." };
  const { data: perfis } = await admin.from("profiles").select("id, is_teste, email, full_name").in("id", [input.tenantId, imovel.owner_id as string]);
  const lista = (perfis ?? []) as { id: string; is_teste: boolean | null; email: string | null; full_name: string | null }[];
  const teste = new Map(lista.map((p) => [p.id, p.is_teste === true]));
  if (!teste.get(input.tenantId) || !teste.get(imovel.owner_id as string)) return { ok: false, error: "Só contas de teste (is_teste) — inquilino e proprietário." };
  if (input.tenantId === imovel.owner_id) return { ok: false, error: "O inquilino não pode ser o dono do anúncio." };
  const inq = lista.find((p) => p.id === input.tenantId);
  const inquilino = inq?.email ?? inq?.full_name ?? input.tenantId;
  const anuncio = (imovel.title as string) ?? "Anúncio";

  // Idempotente: jornada aberta (aceita e sem contrato assinado pelas duas partes) → devolve a mesma.
  const { data: aceitas } = await admin
    .from("leads")
    .select("id, accepted_at")
    .eq("tenant_id", input.tenantId)
    .eq("property_id", input.propertyId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });
  for (const l of (aceitas ?? []) as { id: string; accepted_at: string | null }[]) {
    const { data: c } = await admin.from("contratos").select("assinado_proprietario_em, assinado_inquilino_em").eq("lead_id", l.id).maybeSingle();
    if (!c || !c.assinado_proprietario_em || !c.assinado_inquilino_em) {
      const motivo = !c
        ? "ela está aceita e ainda não tem contrato"
        : "o contrato dela ainda não foi assinado pelas duas partes";
      return { ok: true, reaproveitada: true, motivo, link: `/dashboard/fechamento?c=${l.id}`, ...detalhe(l.id, anuncio, inquilino, l.accepted_at) };
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
  // Caminho no formato que o banco exige: <inquilino>/<candidatura>/<uuid>.pdf.
  for (const tipo of ["identidade", "vinculo"]) {
    const { error: eDoc } = await admin.from("documentos_inquilino").insert({
      lead_id: lead.id,
      tenant_id: input.tenantId,
      tipo,
      caminho: `${input.tenantId}/${lead.id}/${randomUUID()}.pdf`,
      hash_sha256: "0".repeat(64),
    });
    if (eDoc) return { ok: false, error: `Candidatura criada, mas os documentos fictícios falharam: ${eDoc.message}` };
  }
  return { ok: true, reaproveitada: false, link: `/dashboard/fechamento?c=${lead.id}`, ...detalhe(lead.id as string, anuncio, inquilino, agora) };
}
