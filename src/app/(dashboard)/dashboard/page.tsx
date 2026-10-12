import { listMyProperties } from "@/lib/data/properties";
import { VisaoGeral } from "./visao-geral-client";

/**
 * Visão geral. Os imóveis do proprietário vêm do SERVIDOR pela MESMA consulta
 * de "Meus imóveis" (listMyProperties) — sem o vazio enquanto o navegador
 * buscava a lista, que fazia a tela dizer "ainda não publicou" com imóvel
 * ativo (F31).
 */
export default async function DashboardPage() {
  const imoveisDono = await listMyProperties();
  return <VisaoGeral imoveisDono={imoveisDono} />;
}
