import Link from "next/link";
import { ChevronRight, Clock, Home, Lock, Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { AvaliacoesRecebidasLista } from "@/components/avaliacoes/recebidas-lista";
import { hrefAvaliarEstadia } from "@/lib/avaliacoes";
import type { AvaliacaoRecebidaComRevisao } from "@/lib/data/avaliacoes-recebidas";
import type { AvaliacaoFeita } from "@/lib/data/avaliacoes-painel";
import type { AbaAvaliacoes } from "@/lib/conta/avaliacoes-recebidas";
import { ABAS_PAINEL, dataLonga, haDias, rotuloAba, rotuloFaltam, rotuloStatusFeita, TEXTO_SIGILO, type AbaPainel, type ParaAvaliar } from "@/lib/conta/painel-avaliacoes";
import { estrelasDaNota } from "@/lib/conta/tela-avaliacoes";
import { cn } from "@/lib/utils";
import { FILEIRA_ABAS } from "@/components/ui/abas-fileira";

const ROTA = "/dashboard/avaliacoes";

function Estrelas({ nota }: { nota: number }) {
  const cheias = estrelasDaNota(nota);
  return (
    <span className="flex gap-1 text-amber-500" role="img" aria-label={`Nota ${nota} de 5`} data-cheias={cheias}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={cn("h-5 w-5", i < cheias ? "fill-current" : "text-line")} aria-hidden />
      ))}
    </span>
  );
}

/** E679 — o painel Avaliações unificado (mockup avaliacoes-painel): só a parte visual; a página busca os dados. */
export function PainelAvaliacoes({
  aba,
  filtro,
  busca,
  recebidas,
  feitas,
  paraAvaliar,
}: {
  aba: AbaPainel;
  filtro: AbaAvaliacoes;
  busca: string;
  recebidas: { userId: string; avaliacoes: AvaliacaoRecebidaComRevisao[] };
  feitas: AvaliacaoFeita[];
  paraAvaliar: ParaAvaliar[];
}) {
  const recentes = [...recebidas.avaliacoes]
    .sort((a, b) => (Date.parse(b.publicadaEm ?? "") || 0) - (Date.parse(a.publicadaEm ?? "") || 0))
    .slice(0, 2);
  return (
    // E898: o painel mora na casca da Conta (CascaConta ativo="avaliacoes", na página): o título, o voltar ("‹ Conta" no
    // celular), o menu lateral e a largura vêm de lá, como nas seções irmãs. Aqui só o conteúdo.
    <div className="w-full" data-testid="avaliacoes-painel">
      {/* E782: abas como as outras telas do painel (sublinhado, como Favoritos): o título da seção NÃO repete o da aba ativa. */}
      <nav className={cn("mt-4", FILEIRA_ABAS)} data-testid="painel-abas" aria-label="Avaliações">
        {ABAS_PAINEL.map((a) => (
          <Link
            key={a.valor}
            href={`${ROTA}?aba=${a.valor}`}
            aria-current={aba === a.valor ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:text-base",
              aba === a.valor ? "border-forest text-forest" : "border-transparent text-muted hover:text-ink"
            )}
            data-testid={`painel-aba-${a.valor}`}
          >
            {rotuloAba(a.valor, paraAvaliar.length)}
          </Link>
        ))}
      </nav>

      {aba === "para-avaliar" && (
        <div className="mt-6" data-testid="painel-para-avaliar" aria-label="Para avaliar" role="region">
          {paraAvaliar.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={Star}
                title="Nada para avaliar agora"
                text="Quando uma estadia termina, você tem 14 dias para avaliar a outra parte."
                action={
                  <ButtonLink href="/dashboard/locacoes" variant="secondary" size="sm">
                    Ver minhas estadias
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <ul className="mt-3 grid gap-3">
              {paraAvaliar.map((p) => (
                <li key={p.contratoId} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl bg-white p-4 border border-line sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-x-5" data-testid="painel-cartao-avaliar">
                  <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-forest sm:h-20 sm:w-20">
                    <Home className="h-8 w-8" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-ink">
                      {p.papel === "dono" ? "Avalie o morador" : "Avalie sua estadia"} <span className="font-normal">— {p.titulo}</span>
                    </p>
                    {p.encerradoEm && <p className="mt-1 text-sm text-muted">Contrato encerrado em {dataLonga(p.encerradoEm)}</p>}
                    <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900" data-testid="painel-prazo">
                      <Clock className="h-4 w-4" aria-hidden /> {rotuloFaltam(p.dias)}
                    </span>
                  </div>
                  <ButtonLink href={hrefAvaliarEstadia(p.contratoId, p.papel)} variant="outline" size="lg" className="col-span-2 sm:col-span-1" data-testid="painel-avaliar-agora">
                    Avaliar agora
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 flex items-center gap-3 rounded-xl bg-sage-100 px-4 py-3 text-sm text-ink" data-testid="painel-sigilo">
            <Lock className="h-5 w-5 shrink-0 text-forest" aria-hidden /> {TEXTO_SIGILO}
          </p>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-forest">Recebidas recentes</h2>
            <Link href={`${ROTA}?aba=recebidas`} className="inline-flex min-h-11 min-w-11 items-center justify-center text-forest" aria-label="Ver todas as recebidas">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          {recentes.length === 0 ? (
            <p className="mt-2 text-sm text-muted" data-testid="painel-sem-recebidas">
              Ainda não há avaliações publicadas sobre você.
            </p>
          ) : (
            <ul className="mt-2 grid gap-3">
              {recentes.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl bg-white p-4 border border-line" data-testid="painel-recebida-recente">
                  {a.autorFotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.autorFotoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-100 text-lg font-semibold text-forest">
                      {a.autorNome.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {a.autorNome} avaliou {a.papelAutor === "proprietario" ? "você como morador" : "sua estadia"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Estrelas nota={a.nota} />
                      <span className="text-sm text-muted">
                        {haDias(a.publicadaEm)} · já publicada
                      </span>
                    </div>
                  </div>
                  {!a.resposta && (
                    <Link href={`${ROTA}?aba=recebidas#avaliacao-${a.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline underline-offset-2" data-testid="painel-responder">
                      Responder
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {aba === "recebidas" && (
        <div className="mt-6">
          <AvaliacoesRecebidasLista res={recebidas} filtro={filtro} busca={busca} />
        </div>
      )}

      {aba === "feitas" && (
        <div className="mt-6" data-testid="painel-feitas" aria-label="Feitas" role="region">
          {feitas.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={Star} title="Você ainda não avaliou ninguém" text="As avaliações que você enviar aparecem aqui, com o estado de cada uma."
                action={
                  <ButtonLink href={`${ROTA}?aba=para-avaliar`} variant="secondary" size="sm">
                    Ver o que falta avaliar
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <ul className="mt-3 grid gap-3">
              {feitas.map((f) => (
                <li key={f.id} className="rounded-xl bg-white p-4 border border-line" data-testid="painel-feita">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-lg font-semibold text-ink">{f.papelAutor === "proprietario" ? "Você avaliou o morador" : "Você avaliou o proprietário"}</p>
                    <Estrelas nota={f.nota} />
                  </div>
                  {f.imovelTitulo && <p className="text-sm text-muted">{f.imovelTitulo}</p>}
                  {f.comentario && <p className="mt-2 text-base text-ink">{f.comentario}</p>}
                  <p className="mt-2 text-sm font-medium text-forest" data-testid="painel-feita-estado">
                    {rotuloStatusFeita(f.status)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
