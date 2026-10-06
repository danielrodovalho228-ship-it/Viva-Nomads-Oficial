import { notFound } from "next/navigation";
import { chamadoAdmin, listarMacros } from "@/lib/data/atendimento-actions";
import { ChamadoAdminClient } from "./chamado-client";

export const metadata = { title: "Chamado — Atendimento" };

export default async function ChamadoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dados, macros] = await Promise.all([chamadoAdmin(id), listarMacros()]);
  if (!dados) notFound();
  return <ChamadoAdminClient dados={dados} macros={macros} agoraISO={new Date().toISOString()} />;
}
