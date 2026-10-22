import { Briefcase, Car, GraduationCap, HeartPulse, Home, type LucideIcon } from "lucide-react";
import type { Property } from "@/lib/types";
import { destaquesDoImovel, type ChaveDestaque } from "@/lib/anuncio/resumos-imovel";
import { CLASSE_ICONE_LISTA, TRACO_ICONE_LISTA } from "@/lib/anuncio/comodidades-icones";

const ICONES: Record<ChaveDestaque, LucideIcon> = {
  saude: HeartPulse,
  educacao: GraduationCap,
  pronto: Home,
  trabalho: Briefcase,
  vaga: Car,
};

/** Até 3 destaques logo abaixo do título; só com dado real (sem dado = nada). */
export function DestaquesImovel({ property }: { property: Property }) {
  const itens = destaquesDoImovel(property);
  if (itens.length === 0) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-3" data-testid="destaques-imovel" aria-label="Destaques do imóvel">
      {itens.map((d) => {
        const Icone = ICONES[d.chave];
        return (
          <li key={d.chave} className="flex items-start gap-3 rounded-xl border border-sage-200 px-3 py-3">
            <Icone className={CLASSE_ICONE_LISTA} strokeWidth={TRACO_ICONE_LISTA} aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{d.titulo}</span>
              {d.detalhe && <span className="block truncate text-xs text-muted">{d.detalhe}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
