"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { numBR } from "@/lib/utils";
import { iniciais, corAvatar } from "@/lib/avatar";
import { AVISO_EXEMPLO, type AvaliacaoExemplo } from "@/config/exemplo-proprietarios";
import { SeloExemplo } from "@/components/property/selo-exemplo";

const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const mesAno = (aaaamm: string) => `${MESES[Number(aaaamm.slice(5, 7)) - 1] ?? ""} ${aaaamm.slice(0, 4)}`.trim();
const LIMITE = 140;

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="inline-flex" aria-label={`Nota ${numBR(nota, 0)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden className={i <= nota ? "h-4 w-4 fill-champagne text-champagne" : "h-4 w-4 text-sage-200"} />
      ))}
    </span>
  );
}

function CartaoAvaliacao({ a }: { a: AvaliacaoExemplo }) {
  const [aberto, setAberto] = useState(false);
  const longo = a.texto.length > LIMITE;
  return (
    <article data-testid="avaliacao-exemplo" className="rounded-xl border border-sage-200 p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: corAvatar(a.autor) }}
        >
          {iniciais(a.autor)}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink">{a.autor}</p>
          <p className="text-xs text-muted">{mesAno(a.mes)}</p>
        </div>
        <span className="ml-auto">
          <Estrelas nota={a.nota} />
        </span>
      </div>
      <p className="mt-3 font-semibold text-ink">{a.titulo}</p>
      <p className="mt-1 text-sm text-muted">{longo && !aberto ? `${a.texto.slice(0, LIMITE).trimEnd()}…` : a.texto}</p>
      {longo && (
        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="mt-1 text-sm font-semibold text-forest underline underline-offset-2">
          {aberto ? "Ler menos" : "Ler mais"}
        </button>
      )}
      {a.resposta && (
        <div className="mt-3 rounded-xl bg-sage-50 p-3" data-testid="avaliacao-resposta">
          <p className="text-xs font-semibold text-forest">Resposta do proprietário</p>
          <p className="mt-1 text-sm text-ink">{a.resposta}</p>
        </div>
      )}
    </article>
  );
}

/**
 * Avaliações ILUSTRATIVAS dos anúncios de exemplo (prompt 9). Sempre com o selo "Exemplo ilustrativo"
 * e o aviso; nunca entram no JSON-LD nem na média de anúncio real.
 */
export function AvaliacoesExemplo({ avaliacoes }: { avaliacoes: AvaliacaoExemplo[] }) {
  const media = avaliacoes.reduce((s, a) => s + a.nota, 0) / avaliacoes.length;
  return (
    <section aria-labelledby="avaliacoes-title" data-testid="avaliacoes-exemplo">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="avaliacoes-title" className="flex items-center gap-2 font-title text-2xl font-semibold text-ink">
          Avaliações
          <span className="inline-flex items-center gap-1 text-base font-semibold text-forest">
            <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden />
            {numBR(media, 1)} · {avaliacoes.length}
          </span>
        </h2>
        <SeloExemplo />
      </div>
      <p className="mt-2 text-sm text-muted">{AVISO_EXEMPLO}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {avaliacoes.map((a) => (
          <CartaoAvaliacao key={`${a.autor}-${a.mes}`} a={a} />
        ))}
      </div>
      <div className="mt-5">
        <button
          type="button"
          disabled
          aria-describedby="escrever-avaliacao-dica"
          className="inline-flex min-h-11 cursor-not-allowed items-center rounded-full border border-sage-200 px-5 text-sm font-semibold text-muted"
        >
          Escrever avaliação
        </button>
        <p id="escrever-avaliacao-dica" className="mt-2 text-xs text-muted">
          Disponível após uma estadia verificada.
        </p>
      </div>
    </section>
  );
}
