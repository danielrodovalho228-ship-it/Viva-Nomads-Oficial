import { Star, MessageSquareQuote } from "lucide-react";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { SeloVinculo } from "@/components/confianca/selo-vinculo";
import { numBR } from "@/lib/utils";
import type { Property, Review } from "@/lib/types";
import { ComoFuncionamAvaliacoes } from "@/components/avaliacoes/como-funcionam-avaliacoes";
import { linhaAutorAvaliacao } from "@/lib/avaliacoes-exibicao";

/** "abr. 2026" a partir de uma data ISO. */
const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
function reviewDate(iso?: string): string | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : null;
}

/**
 * Avaliações reais dos inquilinos. Sem avaliações ainda: estado vazio honesto e
 * convidativo (ordem d943f893) — nada inventado; só avalia quem morou no imóvel.
 */
export function Reviews({ property }: { property: Property }) {
  const reviews: Review[] = property.reviews ?? [];
  if (reviews.length === 0)
    return (
      <section aria-labelledby="avaliacoes-title">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 id="avaliacoes-title" className="font-title text-2xl font-semibold text-ink">
            Avaliações
          </h2>
          <ComoFuncionamAvaliacoes />
        </div>
        <div data-testid="avaliacoes-vazio" className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-sage-200 px-6 py-8 text-center">
          <MessageSquareQuote className="h-8 w-8 text-sage" aria-hidden />
          <p className="mt-3 font-title text-lg font-semibold text-ink">Este imóvel ainda não tem avaliações</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Só quem morou aqui pode avaliar — a avaliação é liberada ao fim da estadia, e as duas partes avaliam às
            cegas.
          </p>
          <div className="mt-3 flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5 text-sage-200" />
            ))}
          </div>
        </div>
      </section>
    );

  const avg = property.rating > 0 ? property.rating : avgOf(reviews);

  return (
    <section aria-labelledby="avaliacoes-title">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="avaliacoes-title" className="flex items-center gap-2 font-title text-2xl font-semibold text-ink">
          Avaliações
          <span className="inline-flex items-center gap-1 text-base font-semibold text-forest">
            <Star className="h-4 w-4 fill-champagne text-champagne" />
            {numBR(avg, 1)} · {reviews.length}
          </span>
        </h2>
        <ComoFuncionamAvaliacoes />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {reviews.map((r, i) => {
          const date = reviewDate(r.date);
          const autor = linhaAutorAvaliacao(r);
          return (
            <div key={`${r.author}-${i}`} className="rounded-xl border border-sage-200 p-4" data-testid="avaliacao-real">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{r.author}</span>
                <span className="inline-flex items-center gap-1 text-sm text-forest">
                  <Star className="h-4 w-4 fill-champagne text-champagne" /> {numBR(r.rating, 1)}
                </span>
              </div>
              {autor && (
                <p className="text-xs text-muted" data-testid="avaliacao-autor">
                  {autor}
                </p>
              )}
              {r.linkedinConectado && <SeloLinkedin className="mt-1" />}
              {r.vinculoDominio && <SeloVinculo dominio={r.vinculoDominio} className="mt-1" />}
              {date && <p className="text-xs text-muted">{date}</p>}
              <p className="mt-2 text-sm text-muted">{r.comment}</p>
              {r.reply && (
                <div className="mt-3 rounded-xl bg-sage-50 p-3" data-testid="avaliacao-resposta">
                  <p className="text-xs font-semibold text-forest">Resposta do proprietário</p>
                  <p className="mt-1 text-sm text-ink">{r.reply}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function avgOf(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}
