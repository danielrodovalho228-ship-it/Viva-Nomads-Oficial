import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações", robots: { index: false } };

/**
 * E679 (E85): as duas telas "Avaliações" viraram UMA, em /dashboard/avaliacoes. Esta rota antiga só leva para lá,
 * mantendo o filtro (Todas, Recentes, Positivas) e a busca de quem tinha o endereço salvo.
 */
export default async function ContaAvaliacoesRedireciona({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const sp = await searchParams;
  const filtro = sp.aba === "recentes" || sp.aba === "positivas" ? `&filtro=${sp.aba}` : "";
  const busca = sp.q ? `&q=${encodeURIComponent(sp.q.slice(0, 80))}` : "";
  redirect(`/dashboard/avaliacoes?aba=recebidas${filtro}${busca}`);
}
