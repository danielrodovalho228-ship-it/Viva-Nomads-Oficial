import { Wifi, Building2, Users, Coffee } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Property, WorkspaceType } from "@/lib/types";
import { fraseInternetAnuncio } from "@/lib/internet";
import { CLASSE_ICONE_LISTA, TRACO_ICONE_LISTA, iconeDaComodidade } from "@/lib/anuncio/comodidades-icones";

const WORKSPACE_ICONS: Record<WorkspaceType, LucideIcon> = {
  coworking: Building2,
  meeting_room: Users,
  cafe: Coffee,
};
const WORKSPACE_LABEL: Record<WorkspaceType, string> = {
  coworking: "Coworking",
  meeting_room: "Sala de reunião",
  cafe: "Café de trabalho",
};

/**
 * Espaço de trabalho — o diferencial do público profissional em transição.
 * Internet/velocidade, mesa, ambiente e espaços de trabalho na região. Some por
 * completo se o imóvel não tem nenhum desses dados.
 */
export function WorkspaceSection({ property }: { property: Property }) {
  const hasInternet = !!property.internetTier;
  const hasFeatures = property.workFeatures.length > 0;
  const hasNearby = property.nearbyWorkspaces.length > 0;
  if (!hasInternet && !hasFeatures && !hasNearby) return null;

  return (
    <section aria-labelledby="trabalho-title">
      <h2 id="trabalho-title" className="font-title text-2xl font-semibold text-ink">
        Espaço de trabalho
      </h2>

      {hasInternet && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-champagne/40 bg-champagne/5 px-4 py-3 text-sm">
          <Wifi className="mt-1 h-4 w-4 shrink-0 text-champagne-600" />
          <span className="text-ink">{fraseInternetAnuncio(property.internetTier!, [...(property.workFeatures ?? []), ...(property.amenities ?? [])])}</span>
        </div>
      )}

      {hasFeatures && (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3" data-testid="trabalho-itens">
          {property.workFeatures.map((f) => {
            const Icone = iconeDaComodidade(f);
            return (
              <li key={f} className="flex items-center gap-3 text-sm text-ink">
                <Icone className={CLASSE_ICONE_LISTA} strokeWidth={TRACO_ICONE_LISTA} aria-hidden /> {f}
              </li>
            );
          })}
        </ul>
      )}

      {hasNearby && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-forest">Espaços de trabalho na região</h3>
          <ul className="mt-3 space-y-2">
            {property.nearbyWorkspaces.map((w) => {
              const Icon = WORKSPACE_ICONS[w.type];
              return (
                <li
                  key={w.name}
                  className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3"
                >
                  <Icon className={CLASSE_ICONE_LISTA} strokeWidth={TRACO_ICONE_LISTA} aria-hidden />
                  <span>
                    <span className="block text-sm font-medium text-ink">{w.name}</span>
                    <span className="block text-xs text-muted">{WORKSPACE_LABEL[w.type]}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
