import { getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { documentosDosContratos } from "@/lib/data/documentos-actions";
import { LocacoesClient } from "./locacoes-client";

export const metadata = { title: "Minhas locações" };

export default async function LocacoesPage() {
  const locacoes = await getMinhasLocacoes();
  // Recibos, comprovantes e a devolução da caução de cada locação (o RLS filtra).
  const extras = await documentosDosContratos(locacoes.map((l) => l.id));
  return <LocacoesClient locacoes={locacoes} extras={extras} />;
}
