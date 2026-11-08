import { redirect } from "next/navigation";
import { PainelAvaliacoes } from "@/components/avaliacoes/painel";
import { avaliacoesRecebidas } from "@/lib/data/avaliacoes-recebidas";
import { avaliacoesFeitas, avaliacoesParaFazer } from "@/lib/data/avaliacoes-painel";
import { ABAS_AVALIACOES, type AbaAvaliacoes } from "@/lib/conta/avaliacoes-recebidas";
import { abaDoPainel } from "@/lib/conta/painel-avaliacoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações", robots: { index: false } };

/**
 * E679 — painel Avaliações UNIFICADO (mockup avaliacoes-painel, desktop e celular). Um só painel, um só nome e um só
 * destino para todos os papéis (resolve a duplicação do E85): "Para avaliar", "Recebidas" e "Feitas". A antiga tela da
 * Conta (/dashboard/conta/avaliacoes) redireciona para cá. Sem migração; só lê o que já existe.
 */
export default async function AvaliacoesPainelPage({ searchParams }: { searchParams: Promise<{ aba?: string; filtro?: string; q?: string }> }) {
  const sp = await searchParams;
  const aba = abaDoPainel(sp.aba);
  // Os filtros da aba "Recebidas" (Todas, Recentes, Positivas): o valor novo (?filtro=) ou o antigo (?aba=positivas).
  const pedido = sp.filtro ?? sp.aba;
  const filtro: AbaAvaliacoes = ABAS_AVALIACOES.some((a) => a.valor === pedido) ? (pedido as AbaAvaliacoes) : "todas";
  const busca = (sp.q ?? "").slice(0, 80);

  const [recebidas, feitasRes] = await Promise.all([avaliacoesRecebidas({ exigir: true }), avaliacoesFeitas({ exigir: true })]);
  if (!recebidas || !feitasRes) redirect("/auth?next=/dashboard/avaliacoes");
  const paraAvaliar = await avaliacoesParaFazer(new Set(feitasRes.feitas.map((f) => f.contratoId)));
  return <PainelAvaliacoes aba={aba} filtro={filtro} busca={busca} recebidas={recebidas} feitas={feitasRes.feitas} paraAvaliar={paraAvaliar} />;
}
