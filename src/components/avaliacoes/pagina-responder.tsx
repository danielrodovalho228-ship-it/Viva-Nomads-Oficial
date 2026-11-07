"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Star, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcoesAvaliacao } from "@/app/(dashboard)/dashboard/avaliacoes/acoes";
import { responderAvaliacao } from "@/lib/data/avaliacoes-resposta-actions";
import { LIMITE_RESPOSTA } from "@/lib/avaliacoes-resposta";
import { linhaContextoResposta, mesEAno, TEXTO_UMA_RESPOSTA } from "@/lib/avaliacoes-responder";
import { estrelasDaNota } from "@/lib/conta/tela-avaliacoes";
import { semQuedaDeRede } from "@/lib/erro-de-rede";
import { cn } from "@/lib/utils";

export interface AvaliacaoParaResponder {
  id: string;
  autorNome: string;
  autorFotoUrl: string | null;
  nota: number;
  comentario: string;
  publicadaEm: string | null;
  imovelTitulo: string | null;
  cidade: string | null;
  /** A resposta já publicada (a avaliação aceita uma só). */
  resposta: string | null;
  podeResponder: boolean;
  podeContestar: boolean;
  contestacaoAberta: boolean;
}

/**
 * E679 (PR 3) — "Responder à avaliação", igual aos mockups avaliacoes-responder-*: a avaliação recebida, o aviso de UMA
 * resposta pública (sem editar nem apagar), "Sua resposta" com contador, "Publicar resposta" e o link "Contestar avaliação".
 */
export function PaginaResponder({ a, demo = false }: { a: AvaliacaoParaResponder; demo?: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const cheias = estrelasDaNota(a.nota);

  const publicar = () =>
    start(async () => {
      setErro(null);
      if (demo) return;
      const r = await semQuedaDeRede(responderAvaliacao(a.id, texto));
      if (!r.ok) return setErro(r.error ?? "Não foi possível publicar.");
      router.push("/dashboard/avaliacoes?aba=recebidas");
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-3xl" data-testid="pagina-responder">
      <Link href="/dashboard/avaliacoes?aba=recebidas" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
      </Link>
      <h1 className="mt-2 font-title text-2xl font-semibold text-forest sm:text-[28px]">Responder à avaliação</h1>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="responder-avaliacao">
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
            <p className="text-xl font-semibold text-ink">
              {a.autorNome}
              {a.publicadaEm && <span className="ml-2 text-base font-normal text-muted">· {mesEAno(a.publicadaEm)}</span>}
            </p>
            <span className="mt-1 flex gap-1" role="img" aria-label={`Nota ${a.nota} de 5`} data-cheias={cheias}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className={cn("h-5 w-5", i < cheias ? "fill-amber-500 stroke-amber-600 text-amber-600" : "text-sage")} aria-hidden />
              ))}
            </span>
          </div>
        </div>
        <p className="mt-3 text-base text-ink">{a.comentario ? `“${a.comentario}”` : "Sem comentário."}</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted" data-testid="responder-contexto">
          <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden /> {linhaContextoResposta(a)}
        </p>
      </section>

      {a.resposta ? (
        <section className="mt-4 rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="responder-ja-respondida">
          <h2 className="text-xl font-semibold text-forest">Sua resposta</h2>
          <p className="mt-2 rounded-xl bg-sage-100 p-3 text-base text-ink" data-testid="avaliacao-resposta">
            {a.resposta}
          </p>
          <p className="mt-2 text-sm text-muted">Você já respondeu. A resposta é uma só e não se edita nem se apaga.</p>
        </section>
      ) : (
        <>
          <p className="mt-4 flex items-start gap-3 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900" data-testid="responder-aviso">
            <TriangleAlert className="mt-1 h-5 w-5 shrink-0" aria-hidden /> {TEXTO_UMA_RESPOSTA}
          </p>
          {a.podeResponder && (
            <section className="mt-4 rounded-xl border border-line bg-white p-4 sm:p-6">
              <h2 className="text-xl font-semibold text-forest">Sua resposta</h2>
              <div className="relative mt-2">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={LIMITE_RESPOSTA}
                  rows={4}
                  aria-label="Sua resposta"
                  className="w-full rounded-xl border border-sage-200 px-3 pb-6 pt-2 text-base outline-none focus:border-sage"
                  data-testid="responder-texto"
                />
                <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted" data-testid="responder-contador">
                  {texto.length}/{LIMITE_RESPOSTA}
                </span>
              </div>
              {erro && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {erro}
                </p>
              )}
              <Button variant="primary" size="lg" className="mt-3 w-full" onClick={publicar} disabled={pendente || texto.trim().length === 0} data-testid="responder-publicar">
                Publicar resposta
              </Button>
              {a.podeContestar && (
                <div className="mt-3 text-center text-sm text-muted" data-testid="responder-contestar">
                  A avaliação tem ofensa ou um fato errado?{" "}
                  <AcoesAvaliacao avaliacaoId={a.id} podeResponder={false} podeRevisar rotuloRevisar="Contestar avaliação" comoLink />
                </div>
              )}
            </section>
          )}
        </>
      )}
      {a.contestacaoAberta && (
        <p className="mt-3 text-sm font-semibold text-forest" data-testid="revisao-em-analise">
          Pedido de revisão em análise pela equipe.
        </p>
      )}
    </div>
  );
}
