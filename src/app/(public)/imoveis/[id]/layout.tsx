import { notFound, redirect } from "next/navigation";
import { anuncioPausadoPublico, getProperty, imovelPeloCodigo } from "@/lib/data/properties";
import { prefixoDoCodigo } from "@/lib/imovel-pagina";

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
  // E393: o código público (VN-3F9A2C) abre o mesmo anúncio, no endereço canônico. Aqui, antes do 404 e da fronteira
  // de Suspense, o redirecionamento sai como 307 de verdade. Código que não bate com exatamente um anúncio: 404.
  const prefixo = prefixoDoCodigo(decodeURIComponent(id));
  if (prefixo) {
    const alvo = await imovelPeloCodigo(prefixo);
    if (alvo) redirect(`/imoveis/${alvo}`);
    notFound();
  }
  // 64-B: pausado não é 404 (a página mostra "Este anúncio está pausado"); rascunho e inexistente continuam 404.
  if (!(await getProperty(id)) && !(await anuncioPausadoPublico(id))) notFound();
  return children;
}
