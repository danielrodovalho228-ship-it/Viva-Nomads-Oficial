import { notFound, redirect } from "next/navigation";
import { PaginaAvaliar } from "@/components/avaliacoes/pagina-avaliar";
import { estadiaParaAvaliar } from "@/lib/data/avaliacoes-painel";
import { hrefPaginaAvaliar } from "@/lib/avaliacoes-pagina";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliar a estadia", robots: { index: false } };

/**
 * E679 (PR 2) — a página de avaliar uma estadia, para os dois lados (morador e proprietário): "Avalie sua estadia" e
 * "Avalie o morador". Só quem é parte do contrato a vê (a leitura é pela sessão); de outra pessoa é 404.
 */
export default async function AvaliarEstadiaPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect(`/auth?next=${encodeURIComponent(hrefPaginaAvaliar(contratoId))}`);
  const e = await estadiaParaAvaliar(contratoId);
  if (!e) notFound();
  return <PaginaAvaliar e={e} />;
}
