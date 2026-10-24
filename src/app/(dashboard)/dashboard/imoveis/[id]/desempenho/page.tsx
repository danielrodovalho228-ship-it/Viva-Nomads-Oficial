import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { painelDesempenho } from "@/lib/data/desempenho-anuncio";
import { TEXTO_SEM_COMPARACAO, FORMULAS, textoVariacao } from "@/lib/anuncio/desempenho";

export const dynamic = "force-dynamic";

const fmt = (v: number | null, unidade: "" | "%") => (v == null ? "—" : `${v.toLocaleString("pt-BR")}${unidade}`);
const dataBR = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/**
 * Prompt 54 — desempenho do anúncio: últimos 30 dias contra os 30 anteriores, com a fórmula de cada número, a
 * comparação com imóveis parecidos (só com 5 ou mais) e, ao lado, o que fazer. Nenhum número de ganho estimado.
 */
export default async function DesempenhoDoAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await painelDesempenho(id);
  const maxSemana = p ? Math.max(1, ...p.linha.map((s) => s.visualizacoes)) : 1;
  return (
    <div>
      <Link href="/dashboard/imoveis" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Meus imóveis
      </Link>
      <h1 className="mt-3 font-title text-2xl font-semibold text-ink">Desempenho do anúncio</h1>
      {!p ? (
        <p className="mt-4 text-sm text-muted" data-testid="desempenho-indisponivel">
          Anúncio não encontrado.
        </p>
      ) : (
        <div className="mt-2 max-w-4xl space-y-6">
          <p className="text-sm text-muted">
            {p.titulo} · últimos 30 dias, comparados aos 30 anteriores. Suas visitas ao próprio anúncio e as de contas de teste não entram.
          </p>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="desempenho-metricas">
            {p.metricas.map((m) => {
              const variacao = textoVariacao(m.valor, m.anterior, m.unidade);
              return (
                <div key={m.chave} className="rounded-xl border border-line bg-white p-4" data-testid={`desempenho-${m.chave}`} data-valor={m.valor ?? ""}>
                  <p className="text-sm text-muted">{m.rotulo}</p>
                  <p className="font-title text-2xl font-semibold text-ink">{fmt(m.valor, m.unidade)}</p>
                  {variacao && <p className="text-xs text-ink">{variacao}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {m.mediana != null ? `Parecidos (mediana): ${fmt(m.mediana, m.unidade)}` : m.chave === "resposta" ? "" : TEXTO_SEM_COMPARACAO}
                  </p>
                  <p className="mt-2 text-xs text-muted" data-testid="desempenho-formula">
                    Fórmula: {m.formula}
                  </p>
                </div>
              );
            })}
          </section>
          <p className="text-xs text-muted" data-testid="desempenho-grupo" data-parecidos={p.parecidos}>
            {FORMULAS.mediana} {p.parecidos >= 5 ? `${p.parecidos} imóveis no grupo.` : `${p.parecidos} ${p.parecidos === 1 ? "imóvel" : "imóveis"} no grupo agora.`}
          </p>

          <section className="rounded-xl border border-line bg-white p-4" data-testid="desempenho-acoes">
            <h2 className="font-title text-lg font-semibold text-ink">O que fazer</h2>
            {p.acoes.length === 0 && p.faltaNivel.itens.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Nada pendente na nota de qualidade.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {p.acoes.map((a) => (
                  <li key={a.codigo} data-testid="desempenho-acao">
                    {a.texto}: +{a.pontos.toLocaleString("pt-BR")} na nota de qualidade
                  </li>
                ))}
              </ul>
            )}
            {p.faltaNivel.proximo && (
              <div className="mt-3" data-testid="desempenho-nivel">
                <p className="text-sm font-semibold text-ink">O que falta para {p.faltaNivel.proximo}</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-ink">
                  {p.faltaNivel.itens.slice(0, 8).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <Link href={`/dashboard/imoveis/${p.id}/nivel`} className="mt-1 inline-block text-sm font-medium text-forest underline">
                  Abrir o nível do imóvel
                </Link>
              </div>
            )}
            <p className="mt-2 text-xs text-muted">A nota de qualidade ordena a busca; os pontos acima são os da própria nota.</p>
          </section>

          <section className="rounded-xl border border-line bg-white p-4" data-testid="desempenho-linha">
            <h2 className="font-title text-lg font-semibold text-ink">Visualizações por semana e o que mudou</h2>
            <ol className="mt-3 space-y-2">
              {p.linha.map((s) => (
                <li key={s.inicio} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-sm" data-testid="desempenho-semana">
                  <span className="text-xs text-muted">{dataBR(s.inicio)}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="h-2 rounded-full bg-forest" style={{ width: `${Math.max(2, (s.visualizacoes / maxSemana) * 100)}%` }} aria-hidden />
                      <span className="shrink-0 text-xs text-ink">{s.visualizacoes}</span>
                    </span>
                    {s.marcas.length > 0 && (
                      <span className="block text-xs text-forest" data-testid="desempenho-marca">
                        {s.marcas.join(" · ")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
