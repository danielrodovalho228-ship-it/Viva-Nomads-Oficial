import { notFound } from "next/navigation";
import { chamadoAdmin, listarMacros } from "@/lib/data/atendimento-actions";
import { ChamadoAdminClient } from "./chamado-client";
import { soLeituraNaTela } from "@/lib/qa/observador";

export const metadata = { title: "Chamado — Atendimento" };

export default async function ChamadoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dados, macros] = await Promise.all([chamadoAdmin(id), listarMacros()]);
  if (!dados) notFound();
  // Pendência 3 do QA-LOGIN-B v2: "Denúncia procedente" não tem alvo de teste — o observador da QA só lê.
  const observadorQa = (await soLeituraNaTela([{ id }])).length > 0;
  return <ChamadoAdminClient dados={dados} macros={macros} agoraISO={new Date().toISOString()} observadorQa={observadorQa} />;
}
