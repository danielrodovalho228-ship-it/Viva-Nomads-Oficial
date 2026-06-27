import { Star } from "lucide-react";
import type { Property, Review } from "@/lib/types";

/** "abr. 2026" a partir de uma data ISO. */
const MONTHS = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
function reviewDate(iso?: string): string | null {
  if (!iso) return null;
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : null;
}

/**
 * Avaliações reais dos inquilinos. Some por completo se o imóvel ainda não tem
 * avaliações (não inventa conteúdo).
 */
export function Reviews({ property }: { property: Property }) {
  const reviews: Review[] = property.reviews ?? [];
  if (reviews.length === 0) return null;

  const avg = property.rating > 0 ? property.rating : avgOf(reviews);

  return (
    <section aria-labelledby="avaliacoes-title">
      <h2 id="avaliacoes-title" className="flex items-center gap-2 font-title text-2xl font-bold text-ink">
        Avaliações
        <span className="inline-flex items-center gap-1 text-base font-semibold text-forest">
          <Star className="h-4 w-4 fill-champagne text-champagne" />
          {avg.toFixed(1)} · {reviews.length}
        </span>
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {reviews.map((r, i) => {
          const date = reviewDate(r.date);
          return (
            <div key={`${r.author}-${i}`} className="rounded-2xl border border-sage-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{r.author}</span>
                <span className="inline-flex items-center gap-1 text-sm text-forest">
                  <Star className="h-4 w-4 fill-champagne text-champagne" /> {r.rating.toFixed(1)}
                </span>
              </div>
              {date && <p className="text-xs text-muted">{date}</p>}
              <p className="mt-1.5 text-sm text-muted">{r.comment}</p>
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
