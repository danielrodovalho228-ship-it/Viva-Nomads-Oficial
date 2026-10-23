import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { VISTORIA_ATIVA } from "@/lib/flags";

export const dynamic = "force-dynamic";

type Publico = { numero_credenciado: string; nome_curto: string; cidade: string; avaliacoes_feitas: number; nota_conduta: number | string | null; teste: boolean };

async function avaliador(numero: string): Promise<Publico | null> {
  if (!/^[A-Z]{3}-\d{3,}$/.test(numero)) return null;
  const sb = createPublicClient();
  if (!sb) return null;
  const { data } = await sb.rpc("avaliadores_publicos");
  return ((data ?? []) as Publico[]).find((a) => a.numero_credenciado === numero) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  const { numero } = await params;
  // Enquanto a chave estiver desligada, a página existe para a rede (QA, admin) mas não vai para busca nenhuma.
  return { title: `Avaliador credenciado nº ${numero}`, robots: VISTORIA_ATIVA ? undefined : { index: false, follow: false } };
}

/**
 * Página pública do avaliador credenciado (Prompt 62-B1, ESQUELETO; o desenho é do 62-A): nome curto, número de
 * credenciado, cidade, avaliações feitas e a nota de CONDUTA. Sem botão de contratar: o avaliador é designado pela Viva.
 */
export default async function AvaliadorPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  const a = await avaliador(decodeURIComponent(numero).toUpperCase());
  if (!a) notFound();
  const nota = a.nota_conduta == null ? null : Number(a.nota_conduta);
  return (
    <main className="mx-auto max-w-2xl px-4 py-12" data-testid="avaliador-publico">
      <p className="text-sm text-muted">Avaliador credenciado da Viva</p>
      <h1 className="mt-1 font-title text-2xl font-semibold text-ink">{a.nome_curto}</h1>
      <dl className="mt-6 grid gap-3 text-sm">
        <div><dt className="text-muted">Número de credenciado</dt><dd className="font-semibold text-ink" data-testid="avaliador-numero">{a.numero_credenciado}</dd></div>
        <div><dt className="text-muted">Cidade</dt><dd className="text-ink">{a.cidade}</dd></div>
        <div><dt className="text-muted">Avaliações feitas</dt><dd className="text-ink">{a.avaliacoes_feitas}</dd></div>
        <div><dt className="text-muted">Nota de conduta (pontualidade, cordialidade e cuidado com o imóvel)</dt><dd className="text-ink">{nota == null ? "Ainda sem avaliações de conduta" : `${nota.toLocaleString("pt-BR")} de 5`}</dd></div>
      </dl>
      <p className="mt-6 text-xs text-muted">O avaliador é designado pela Viva por rodízio, sem vínculo com o proprietário. A nota mede só a conduta na visita, nunca o resultado da avaliação.</p>
    </main>
  );
}
