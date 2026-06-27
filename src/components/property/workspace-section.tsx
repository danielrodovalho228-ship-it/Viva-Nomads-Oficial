import { Wifi, Check, Building2, Users, Coffee } from "lucide-react";
import type { Property, WorkspaceType } from "@/lib/types";
import { INTERNET_META } from "@/lib/internet";

const WORKSPACE_ICONS: Record<WorkspaceType, React.ComponentType<{ className?: string }>> = {
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
      <h2 id="trabalho-title" className="font-title text-2xl font-bold text-ink">
        Espaço de trabalho
      </h2>

      {hasInternet && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-champagne/40 bg-champagne/5 px-4 py-3 text-sm">
          <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" />
          <span className="text-ink">{INTERNET_META[property.internetTier!].anuncio}</span>
        </div>
      )}

      {hasFeatures && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {property.workFeatures.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-ink">
              <Check className="h-4 w-4 shrink-0 text-champagne-600" /> {f}
            </li>
          ))}
        </ul>
      )}

      {hasNearby && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-forest">Espaços de trabalho na região</h3>
          <ul className="mt-3 space-y-2">
            {property.nearbyWorkspaces.map((w) => {
              const Icon = WORKSPACE_ICONS[w.type];
              return (
                <li
                  key={w.name}
                  className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3"
                >
                  <Icon className="h-5 w-5 shrink-0 text-sage" />
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
