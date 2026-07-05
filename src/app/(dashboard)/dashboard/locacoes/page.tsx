import { getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { LocacoesClient } from "./locacoes-client";

export const metadata = { title: "Minhas locações" };

export default async function LocacoesPage() {
  const locacoes = await getMinhasLocacoes();
  return <LocacoesClient locacoes={locacoes} />;
}
