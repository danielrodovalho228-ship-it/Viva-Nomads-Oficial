import { Briefcase, UtensilsCrossed, Sofa, Building2, ShieldCheck, Check } from "lucide-react";
import type { AmenityCategory, AmenityGroup, Property } from "@/lib/types";

const CATEGORY_META: Record<AmenityCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  trabalho: { label: "Trabalho", icon: Briefcase },
  cozinha: { label: "Cozinha", icon: UtensilsCrossed },
  conforto: { label: "Conforto", icon: Sofa },
  edificio: { label: "Edifício", icon: Building2 },
  seguranca: { label: "Segurança", icon: ShieldCheck },
};

const CATEGORY_ORDER: AmenityCategory[] = ["trabalho", "cozinha", "conforto", "edificio", "seguranca"];

/**
 * Comodidades agrupadas por categoria, com ícones. Se o imóvel ainda não tem
 * categorização (`amenityGroups`), cai para a lista plana `amenities`. Se não há
 * comodidade nenhuma, a seção inteira some (o componente devolve null).
 */
export function AmenitiesGrid({ property }: { property: Property }) {
  const groups = resolveGroups(property);
  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="comodidades-title">
      <h2 id="comodidades-title" className="font-title text-2xl font-bold text-ink">
        Comodidades
      </h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        {groups.map((g) => {
          const meta = CATEGORY_META[g.category];
          const Icon = meta?.icon ?? Check;
          return (
            <div key={g.category}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-forest">
                <Icon className="h-4 w-4 text-sage" /> {meta?.label ?? g.category}
              </h3>
              <ul className="mt-2 grid gap-2">
                {g.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 shrink-0 text-sage" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function resolveGroups(property: Property): AmenityGroup[] {
  if (property.amenityGroups && property.amenityGroups.length > 0) {
    // Ordena pelas categorias conhecidas; categorias desconhecidas vão ao fim.
    return [...property.amenityGroups].sort(
      (a, b) => catRank(a.category) - catRank(b.category)
    );
  }
  // Fallback: lista plana vira um único grupo "Comodidades".
  if (property.amenities.length > 0) {
    return [{ category: "conforto", items: property.amenities }];
  }
  return [];
}

function catRank(c: AmenityCategory): number {
  const i = CATEGORY_ORDER.indexOf(c);
  return i === -1 ? 99 : i;
}
