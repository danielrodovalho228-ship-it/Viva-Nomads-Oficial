import Link from "next/link";
import { Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { podeContestar, podeResponder } from "@/lib/avaliacoes-resposta";
import { avaliacoesRecebidas } from "@/lib/data/avaliacoes-recebidas";
import { ABAS_AVALIACOES, filtrarAvaliacoes, linhaContextoAvaliacao, type AbaAvaliacoes } from "@/lib/conta/avaliacoes-recebidas";
import { numBR } from "@/lib/utils";
import { AcoesAvaliacao } from "./acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Avaliações" };

/**
 * Avaliações PUBLICADAS sobre mim (RLS: só as minhas). Responder e pedir revisão ficam aqui. PERFIL-B (mockup
 * perfil-02-avaliacoes): quem avaliou (nome curto e foto), o imóvel e a cidade, e as abas Todas / Recentes / Positivas
 * com a busca (?aba=&q=).
 */
export default async function AvaliacoesRecebidasPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const res = await avaliacoesRecebidas();
  if (!res) redirect("/auth?next=/dashboard/avaliacoes");
  const sp = await searchParams;
  const aba: AbaAvaliacoes = ABAS_AVALIACOES.some((a) => a.valor === sp.aba) ? (sp.aba as AbaAvaliacoes) : "todas";
  const busca = (sp.q ?? "").slice(0, 80);
  const avaliacoes = filtrarAvaliacoes(res.avaliacoes, { aba, busca }) as typeof res.avaliacoes;
  const link = (a: AbaAvaliacoes) => `/dashboard/avaliacoes?aba=${a}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`;

  return (
    <div className="w-full" data-testid="avaliacoes-recebidas">
      <PageTitle
        title="Avaliações"
        subtitle="Responda em público ou peça revisão quando houver ofensa, dado pessoal ou fato falso."
      />
      {res.avaliacoes.length > 0 && (
        <div className="mb-4 grid gap-3">
          <nav className="flex flex-wrap gap-2" aria-label="Filtrar avaliações">
            {ABAS_AVALIACOES.map((a) => (
              <Link
                key={a.valor}
                href={link(a.valor)}
                aria-current={aba === a.valor ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm ${aba === a.valor ? "border-forest bg-forest text-white" : "border-line text-ink"}`}
                data-testid={`avaliacoes-aba-${a.valor}`}
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
          <form action="/dashboard/avaliacoes" className="flex gap-2">
            <input type="hidden" name="aba" value={aba} />
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar avaliações"
              aria-label="Buscar avaliações"
              className="min-h-[44px] w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
              data-testid="avaliacoes-busca"
            />
          </form>
        </div>
      )}
      {res.avaliacoes.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma avaliação publicada ainda"
          text="Quando uma estadia termina, as duas partes avaliam. A avaliação aparece aqui depois de publicada." action={<ButtonLink href="/dashboard/locacoes" variant="secondary" size="sm">Ver minhas estadias</ButtonLink>} />
      ) : avaliacoes.length === 0 ? (
        <p className="text-sm text-muted" data-testid="avaliacoes-sem-resultado">
          Nenhuma avaliação neste filtro.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {avaliacoes.map((a) => {
            const base = { alvoId: res.userId, status: "publicada" };
            return (
              <Panel key={a.id} title={`Nota ${numBR(a.nota, 1)}`}>
                <div data-testid="avaliacao-recebida">
                  <div className="mb-2 flex items-center gap-3" data-testid="avaliacao-autor">
                    {a.autorFotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.autorFotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-50 text-sm font-semibold text-forest">
                        {a.autorNome.charAt(0)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-ink">
                      {a.autorNome}
                      <span className="ml-1 font-normal text-muted">· {a.papelAutor === "proprietario" ? "proprietário" : "morador"}</span>
                    </span>
                  </div>
                  <p className="text-sm text-ink">{a.comentario || "Sem comentário."}</p>
                  {linhaContextoAvaliacao(a) && (
                    <p className="mt-2 text-xs text-muted" data-testid="avaliacao-contexto">
                      {linhaContextoAvaliacao(a)}
                    </p>
                  )}
                  {a.resposta && (
                    <p className="mt-3 rounded-xl bg-sage-50 p-3 text-sm text-ink" data-testid="avaliacao-resposta">
                      <span className="block text-xs font-semibold text-forest">Sua resposta</span>
                      {a.resposta}
                    </p>
                  )}
                  {a.contestacaoAberta && (
                    <p className="mt-3 text-sm font-medium text-forest" data-testid="revisao-em-analise">
                      Pedido de revisão em análise pela equipe.
                    </p>
                  )}
                  <AcoesAvaliacao
                    avaliacaoId={a.id}
                    podeResponder={podeResponder({ ...base, jaRespondida: Boolean(a.resposta) }, res.userId)}
                    podeRevisar={podeContestar({ ...base, contestacaoAberta: a.contestacaoAberta }, res.userId)}
                  />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
