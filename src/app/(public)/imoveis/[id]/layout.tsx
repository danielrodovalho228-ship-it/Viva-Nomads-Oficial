import { notFound } from "next/navigation";
import { getProperty } from "@/lib/data/properties";

/**
 * Imóvel inexistente (ou fora do ar) responde 404 de verdade: o loading.tsx abre o stream com 200,
 * então a checagem fica aqui, antes da fronteira de Suspense (docs do Next, "Status codes").
 * getProperty é cacheada por requisição: a página e os metadados não repetem a consulta.
 */
export default async function ImovelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getProperty(id))) notFound();
  return children;
}
