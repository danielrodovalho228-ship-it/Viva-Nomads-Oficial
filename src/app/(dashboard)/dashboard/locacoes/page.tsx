import { getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { getSelosDasLocacoes } from "@/lib/data/locacoes-selo";
import { redirect } from "next/navigation";
import { temImovelAnunciado } from "@/lib/data/menu-actions";
import { LocacoesClient } from "./locacoes-client";
import { BlocoRecibosMorador } from "@/components/recibos/blocos-recibos";

export const metadata = { title: "Minhas locações" };

export default async function LocacoesPage() {
  // Prompt 28: Locações = as ativas e as encerradas; o contrato aguardando assinatura fica em Contratos.
  const locacoes = (await getMinhasLocacoes()).filter((l) => l.status !== "ativo" || l.etapa !== "aguardando_assinatura");
  // Adendo ao prompt 28: o dono sem estadia própria cai em "Contratos & blocos" (o texto vazio daqui é do inquilino).
  if (locacoes.length === 0 && (await temImovelAnunciado())) redirect("/dashboard/contratos");
  // Recibos, comprovantes e a devolução da caução de cada locação (o RLS filtra).
  const extras = await documentosDosContratos(locacoes.map((l) => l.id));
  const selos = await getSelosDasLocacoes(locacoes.map((l) => l.id));
  return (
    <>
      <LocacoesClient locacoes={locacoes} extras={extras} selos={selos} />
      {/* Prompt 39-B1: recibos, Caução, resumo para reembolso e resumo anual de cada estadia. */}
      <BlocoRecibosMorador />
    </>
  );
}
