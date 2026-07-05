"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getReputacaoDoImovel, type Reputacao } from "@/lib/data/avaliacoes-actions";
import { reputacaoLabel } from "@/lib/avaliacoes";
import { cn } from "@/lib/utils";

/**
 * Reputação do proprietário (avaliações bidirecionais) exibida no anúncio.
 * Busca por propertyId — o owner_id fica no servidor. Some se não há avaliações.
 */
export function OwnerRating({ propertyId }: { propertyId: string }) {
  const [rep, setRep] = useState<Reputacao | null>(null);
  useEffect(() => {
    getReputacaoDoImovel(propertyId)
      .then(setRep)
      .catch(() => {});
  }, [propertyId]);

  if (!rep || rep.n === 0) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-sm">
      <div className="flex" aria-label={`Nota ${rep.media} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "h-4 w-4",
              rep.media >= n - 0.25 ? "fill-champagne text-champagne" : "text-sage-200"
            )}
          />
        ))}
      </div>
      <span className="text-muted">{reputacaoLabel(rep.media, rep.n)}</span>
    </div>
  );
}
