import Link from "next/link";
import { CornerUpLeft, Search, Star } from "lucide-react";
import { EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { podeContestar, podeResponder } from "@/lib/avaliacoes-resposta";
import type { AvaliacaoRecebidaComRevisao } from "@/lib/data/avaliacoes-recebidas";
import { ABAS_AVALIACOES, filtrarAvaliacoes, linhaContextoAvaliacao, type AbaAvaliacoes } from "@/lib/conta/avaliacoes-recebidas";
import { SUBTITULO_AVALIACOES, estrelasDaNota, primeiraSemResposta } from "@/lib/conta/tela-avaliacoes";
import { cn } from "@/lib/utils";
import { AcoesAvaliacao } from "@/app/(dashboard)/dashboard/avaliacoes/acoes";

const ROTA = "/dashboard/avaliacoes";

/**
 * E679 — aba "Recebidas" do painel Avaliações unificado: o que a Conta › Avaliações (perfil-02) mostrava, agora dentro
 * do mesmo painel. Filtros Todas / Recentes / Positivas e busca (?filtro=&q=), um cartão por avaliação, Responder e
 * pedir revisão. Os dados e as regras são da Pista B (avaliacoesRecebidas e lib/conta/avaliacoes-recebidas).
 */
export function AvaliacoesRecebidasLista({
  res,
  filtro,
  busca,
}: {
  res: { userId: string; avaliacoes: AvaliacaoRecebidaComRevisao[] };
  filtro: AbaAvaliacoes;
  busca: string;
}) {
  const lista = filtrarAvaliacoes(res.avaliacoes, { aba: filtro, busca }) as typeof res.avaliacoes;
  const link = (a: AbaAvaliacoes) => `${ROTA}?aba=recebidas&filtro=${a}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`;
  const proxima = primeiraSemResposta(lista);
  return (
    <div data-testid="tela-avaliacoes">
        <p className="mb-4 text-sm text-muted">{SUBTITULO_AVALIACOES}</p>
        {/* E63 (QA 24/10): a estrutura do desenho fica sempre — abas e busca — mesmo sem nenhuma avaliação ainda. */}
        <>
          <nav className="flex flex-wrap gap-3" aria-label="Filtrar avaliações">
            {ABAS_AVALIACOES.map((a) => (
              <Link
                key={a.valor}
                href={link(a.valor)}
                aria-current={filtro === a.valor ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-28 items-center justify-center rounded-full border px-6 text-base",
                  filtro === a.valor ? "border-forest bg-forest font-semibold text-white" : "border-line bg-white text-ink"
                )}
                data-testid={`avaliacoes-aba-${a.valor}`}
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
          <form action={ROTA} className="relative mt-4" role="search">
            <input type="hidden" name="aba" value="recebidas" />
            <input type="hidden" name="filtro" value={filtro} />
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar avaliações..."
              aria-label="Buscar avaliações"
              className="min-h-12 w-full rounded-lg border border-line bg-white pl-12 pr-4 text-base text-ink"
              data-testid="avaliacoes-busca"
            />
          </form>

          {res.avaliacoes.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Star}
                title="Nenhuma avaliação publicada ainda"
                text="Quando uma estadia termina, as duas partes avaliam. A avaliação aparece aqui depois de publicada."
                action={
                  <ButtonLink href="/dashboard/locacoes" variant="secondary" size="sm">
                    Ver minhas estadias
                  </ButtonLink>
                }
              />
            </div>
          ) : lista.length === 0 ? (
            <p className="mt-6 text-sm text-muted" data-testid="avaliacoes-sem-resultado">
              Nenhuma avaliação neste filtro.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4">
              {lista.map((a) => {
                const base = { alvoId: res.userId, status: "publicada" };
                const cheias = estrelasDaNota(a.nota);
                return (
                  <li key={a.id} id={`avaliacao-${a.id}`} className="scroll-mt-24">
                    <section className="rounded-xl bg-white p-4 sm:p-6" data-testid="avaliacao-recebida">
                      <div className="flex items-start gap-4">
                        {a.autorFotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.autorFotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xl font-semibold text-forest">
                            {a.autorNome.charAt(0)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xl font-semibold text-ink" data-testid="avaliacao-autor">
                              {a.autorNome}
                            </p>
                            <span className="flex gap-1 text-forest" role="img" aria-label={`Nota ${a.nota} de 5`} data-testid="avaliacao-estrelas" data-cheias={cheias}>
                              {[0, 1, 2, 3, 4].map((i) => (
                                <Star key={i} className={cn("h-5 w-5", i < cheias ? "fill-current" : "text-line")} aria-hidden />
                              ))}
                            </span>
                          </div>
                          <p className="text-sm text-muted" data-testid="avaliacao-papel">
                            {a.papelAutor === "proprietario" ? "Proprietário" : "Morador"}
                          </p>
                          <p className="mt-1 text-base text-ink">{a.comentario || "Sem comentário."}</p>
                          {linhaContextoAvaliacao(a) && (
                            <p className="mt-2 text-sm text-muted" data-testid="avaliacao-contexto">
                              {linhaContextoAvaliacao(a)}
                            </p>
                          )}
                          {a.resposta && (
                            <p className="mt-3 rounded-xl bg-sage-100 p-3 text-sm text-ink" data-testid="avaliacao-resposta">
                              <span className="block text-xs font-semibold text-forest">Sua resposta</span>
                              {a.resposta}
                            </p>
                          )}
                          {a.contestacaoAberta && (
                            <p className="mt-3 text-sm font-semibold text-forest" data-testid="revisao-em-analise">
                              Pedido de revisão em análise pela equipe.
                            </p>
                          )}
                          <AcoesAvaliacao
                            avaliacaoId={a.id}
                            podeResponder={podeResponder({ ...base, jaRespondida: Boolean(a.resposta) }, res.userId)}
                            podeRevisar={podeContestar({ ...base, contestacaoAberta: a.contestacaoAberta }, res.userId)}
                          />
                        </div>
                      </div>
                    </section>
                  </li>
                );
              })}
            </ul>
          )}
          {proxima && (
            <div className="mt-6 flex justify-end">
              <a href={`#avaliacao-${proxima}`} className={buttonClasses({ size: "lg" })} data-testid="avaliacoes-responder">
                <CornerUpLeft className="h-5 w-5" aria-hidden /> Responder avaliações
              </a>
            </div>
          )}
        </>
      </div>
  );
}
