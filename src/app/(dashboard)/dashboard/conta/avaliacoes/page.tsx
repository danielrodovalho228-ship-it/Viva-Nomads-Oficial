import Link from "next/link";
import { redirect } from "next/navigation";
import { CornerUpLeft, Search, Star } from "lucide-react";
import { CascaConta } from "@/components/account/casca-conta";
import { EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { podeContestar, podeResponder } from "@/lib/avaliacoes-resposta";
import { avaliacoesRecebidas } from "@/lib/data/avaliacoes-recebidas";
import { ABAS_AVALIACOES, filtrarAvaliacoes, linhaContextoAvaliacao, type AbaAvaliacoes } from "@/lib/conta/avaliacoes-recebidas";
import { SUBTITULO_AVALIACOES, estrelasDaNota, primeiraSemResposta } from "@/lib/conta/tela-avaliacoes";
import { cn } from "@/lib/utils";
import { AcoesAvaliacao } from "../../avaliacoes/acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações", robots: { index: false } };

const ROTA = "/dashboard/conta/avaliacoes";

/**
 * A2 — Conta › Avaliações (mockup perfil-02): abas Todas / Recentes / Positivas, busca, um cartão por avaliação (foto e
 * nome curto de quem avaliou, as estrelas, o comentário e a linha "Recebida em … · imóvel · cidade") e "Responder
 * avaliações", que leva à primeira ainda sem resposta. Os dados e as regras são da Pista B (PERFIL-B):
 * avaliacoesRecebidas() e lib/conta/avaliacoes-recebidas. Responder e pedir revisão seguem os mesmos do painel.
 */
export default async function ContaAvaliacoesPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const res = await avaliacoesRecebidas();
  if (!res) redirect(`/auth?next=${ROTA}`);
  const sp = await searchParams;
  const aba: AbaAvaliacoes = ABAS_AVALIACOES.some((a) => a.valor === sp.aba) ? (sp.aba as AbaAvaliacoes) : "todas";
  const busca = (sp.q ?? "").slice(0, 80);
  const lista = filtrarAvaliacoes(res.avaliacoes, { aba, busca }) as typeof res.avaliacoes;
  const link = (a: AbaAvaliacoes) => `${ROTA}?aba=${a}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`;
  const proxima = primeiraSemResposta(lista);

  return (
    <CascaConta ativo="avaliacoes" subtitulo={SUBTITULO_AVALIACOES}>
      <div data-testid="tela-avaliacoes">
        {/* E63 (QA 24/10): a estrutura do desenho fica sempre — abas e busca — mesmo sem nenhuma avaliação ainda. */}
        <>
          <nav className="flex flex-wrap gap-3" aria-label="Filtrar avaliações">
            {ABAS_AVALIACOES.map((a) => (
              <Link
                key={a.valor}
                href={link(a.valor)}
                aria-current={aba === a.valor ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 min-w-28 items-center justify-center rounded-full border px-6 text-base",
                  aba === a.valor ? "border-forest bg-forest font-semibold text-white" : "border-line bg-white text-ink"
                )}
                data-testid={`avaliacoes-aba-${a.valor}`}
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
          <form action={ROTA} className="relative mt-4" role="search">
            <input type="hidden" name="aba" value={aba} />
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
    </CascaConta>
  );
}
