import { getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { getSelosDasLocacoes } from "@/lib/data/locacoes-selo";
import { LocacoesClient } from "./locacoes-client";
import { BlocoRecibosMorador } from "@/components/recibos/blocos-recibos";

export const metadata = { title: "Minhas estadias" };

export default async function LocacoesPage() {
  // Prompt 28: Locações = as ativas e as encerradas; o contrato aguardando assinatura fica em Contratos.
  const locacoes = (await getMinhasLocacoes()).filter((l) => l.status !== "ativo" || l.etapa !== "aguardando_assinatura");
  // E176 (D1 + papel persiste): a aba "Estadia" do morador aparece sempre; sem estadia, o estado vazio leva à busca.
  // O dono em modo morador não é mais jogado para os Contratos do dono (isso trocava o papel em silêncio).
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
