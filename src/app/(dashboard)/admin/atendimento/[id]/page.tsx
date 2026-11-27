import { notFound } from "next/navigation";
import { chamadoAdmin, listarMacros } from "@/lib/data/atendimento-actions";
import { ChamadoAdminClient } from "./chamado-client";
import { soLeituraNaTela } from "@/lib/qa/observador";
import { createAdminClient } from "@/lib/supabase/admin";

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
  return <ChamadoAdminClient dados={dados} macros={macros} agoraISO={new Date().toISOString()} observadorQa={observadorQa} anularSoLeitura={anularSoLeitura} />;
}

/** As duas partes do contrato (o morador e o dono do imóvel); sem contrato ou sem leitura, nenhuma. */
async function partesDoContrato(contratoId: string | null | undefined): Promise<{ morador: string | null; dono: string | null }> {
  const admin = createAdminClient();
  if (!admin || !contratoId) return { morador: null, dono: null };
  const { data } = await admin.from("contratos").select("tenant_id, properties(owner_id)").eq("id", contratoId).maybeSingle();
  const c = data as { tenant_id?: string | null; properties?: { owner_id?: string | null } | null } | null;
  return { morador: c?.tenant_id ?? null, dono: c?.properties?.owner_id ?? null };
}
