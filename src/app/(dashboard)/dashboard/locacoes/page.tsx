import { getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { getSelosDasLocacoes } from "@/lib/data/locacoes-selo";
import { LocacoesClient } from "./locacoes-client";

export const metadata = { title: "Minhas locações" };

export default async function LocacoesPage() {
  // Prompt 28: Locações = as ativas e as encerradas; o contrato aguardando assinatura fica em Contratos.
  const locacoes = (await getMinhasLocacoes()).filter((l) => l.status !== "ativo" || l.etapa !== "aguardando_assinatura");
  // Recibos, comprovantes e a devolução da caução de cada locação (o RLS filtra).
  const extras = await documentosDosContratos(locacoes.map((l) => l.id));
  const selos = await getSelosDasLocacoes(locacoes.map((l) => l.id));
  return <LocacoesClient locacoes={locacoes} extras={extras} selos={selos} />;
}
