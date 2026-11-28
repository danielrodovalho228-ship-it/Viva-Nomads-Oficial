import { notFound } from "next/navigation";
import { chamadoAdmin, listarMacros } from "@/lib/data/atendimento-actions";
import { ChamadoAdminClient } from "./chamado-client";
import { soLeituraNaTela } from "@/lib/qa/observador";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { linkDoComprovante } from "@/lib/protecao/servidor";
import { fimDoPrazoDoAnexo, horaAnunciada, prazoDoAnexoTerminou } from "@/lib/caucao/devolucao-maquina";
import type { DevolucaoNoChamado } from "./decidir-devolucao-central";

export const metadata = { title: "Chamado — Atendimento" };

export default async function ChamadoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dados, macros] = await Promise.all([chamadoAdmin(id), listarMacros()]);
  if (!dados) notFound();
  // Pendência 3 do QA-LOGIN-B v2: "Denúncia procedente" não tem alvo de teste — o observador da QA só lê.
  const observadorQa = (await soLeituraNaTela([{ id }])).length > 0;
  // E1246: "Anular este registro" toca as duas partes do contrato do chamado; para a observadora da QA, o cartão só
  // aparece quando as duas são de teste (a mesma regra que a ação aplica no servidor).
  const partes = await partesDoContrato(dados.chamado.contexto_tipo === "contrato" ? dados.chamado.contexto_id : null);
  const anularSoLeitura = (await soLeituraNaTela([{ id: "anular", alvo: { perfis: [partes.morador, partes.dono], semPerfil: partes.morador && partes.dono ? 0 : 1 } }])).length > 0;
  const devolucao = await devolucaoDoChamado(dados.mensagens);
  return <ChamadoAdminClient dados={dados} macros={macros} agoraISO={new Date().toISOString()} observadorQa={observadorQa} anularSoLeitura={anularSoLeitura} devolucao={devolucao} />;
}

/** E1248: a contestação da devolução que o chamado guarda (a nota do sistema) — o comprovante, para a equipe, e a decisão. */
async function devolucaoDoChamado(mensagens: { autor: string; interno?: boolean; corpo: string }[]): Promise<DevolucaoNoChamado | null> {
  const nota = mensagens.find((m) => m.autor === "sistema" && m.interno && /^\[devolucao\] acerto=[0-9a-f-]{36}$/i.test(m.corpo.trim()));
  const admin = createAdminClient();
  const supabase = await createClient();
  if (!nota || !admin || !supabase) return null;
  const acertoId = nota.corpo.trim().split("=")[1];
  const { data: a } = await admin.from("caucao_acertos").select("comprovante_path, comprovante_pedido_em, central_decisao").eq("id", acertoId).maybeSingle();
  if (!a) return null;
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const pedido = (a.comprovante_pedido_em as string | null) ?? null;
  return {
    comprovanteUrl: linkDoComprovante((a.comprovante_path as string | null) ?? null, uid),
    decisao: (a.central_decisao as string | null) ?? null,
    esperaAnexo: pedido && !a.comprovante_path && !prazoDoAnexoTerminou(pedido, new Date()) ? `até ${horaAnunciada(fimDoPrazoDoAnexo(pedido))}` : null,
  };
}

/** As duas partes do contrato (o morador e o dono do imóvel); sem contrato ou sem leitura, nenhuma. */
async function partesDoContrato(contratoId: string | null | undefined): Promise<{ morador: string | null; dono: string | null }> {
  const admin = createAdminClient();
  if (!admin || !contratoId) return { morador: null, dono: null };
  const { data } = await admin.from("contratos").select("tenant_id, properties(owner_id)").eq("id", contratoId).maybeSingle();
  const c = data as { tenant_id?: string | null; properties?: { owner_id?: string | null } | null } | null;
  return { morador: c?.tenant_id ?? null, dono: c?.properties?.owner_id ?? null };
}
