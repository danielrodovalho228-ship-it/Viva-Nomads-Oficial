import { redirect } from "next/navigation";
import { destinoContaAvaliacoes } from "@/lib/conta/redirecionar-no-servidor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações", robots: { index: false } };

/**
 * E679 (E85): as duas telas "Avaliações" viraram UMA, em /dashboard/avaliacoes. Esta rota antiga só leva para lá,
 * mantendo o filtro (Todas, Recentes, Positivas) e a busca de quem tinha o endereço salvo.
 */
export default async function ContaAvaliacoesRedireciona({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  // E798: o proxy já redireciona antes de desenhar; esta página fica como rede de segurança (mesma função).
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.aba) q.set("aba", sp.aba);
  if (sp.q) q.set("q", sp.q);
  redirect(destinoContaAvaliacoes(q));
}
