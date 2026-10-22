import { Wifi, Building2, Users, Coffee } from "lucide-react";
import type { Property, WorkspaceType } from "@/lib/types";
import { fraseInternetAnuncio } from "@/lib/internet";
import { textoInternet } from "@/lib/internet-medida";
import { INTERNET } from "@/config/internet";
import { CLASSE_ICONE_LISTA, TRACO_ICONE_LISTA, iconeDaComodidade } from "@/lib/anuncio/comodidades-icones";

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
  // Prompt 57: medida no imóvel (vigente) > informada pelo dono > nada. Capacidade só com medição válida.
  const internet = textoInternet(property.internetMedida, property.internetMbps, new Date());
  const hasInternet = !!property.internetTier || !!internet;
  const hasFeatures = property.workFeatures.length > 0;
  const hasNearby = property.nearbyWorkspaces.length > 0;
  if (!hasInternet && !hasFeatures && !hasNearby) return null;

  return (
    <section aria-labelledby="trabalho-title">
      <h2 id="trabalho-title" className="font-title text-2xl font-semibold text-ink">
        Espaço de trabalho
      </h2>

      {hasInternet && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-champagne/40 bg-champagne/5 px-4 py-3 text-sm" data-testid="internet-imovel" data-tipo={internet?.tipo ?? "categoria"}>
          <Wifi className="mt-1 h-4 w-4 shrink-0 text-champagne-600" />
          <span className="text-ink">
            {internet?.tipo === "medida" ? (
              <>
                <span className="block" data-testid="internet-medida">{internet.texto}</span>
                {internet.videochamada && <span className="mt-1 block font-semibold text-forest" data-testid="internet-capacidade">{internet.videochamada}</span>}
                <details className="mt-1 text-xs text-muted">
                  <summary className="cursor-pointer font-medium text-forest">Como medimos</summary>
                  O proprietário mede no Wi-Fi do imóvel, com o aparelho a até {INTERNET.raioValidacaoM} m do endereço: duas rodadas no navegador, e vale a média das duas. A medição vale {INTERNET.validadeMeses} meses.
                </details>
              </>
            ) : (
              <>
                {property.internetTier && <span className="block">{fraseInternetAnuncio(property.internetTier, [...(property.workFeatures ?? []), ...(property.amenities ?? [])])}</span>}
                {internet && <span className="block" data-testid="internet-informada">{internet.texto}</span>}
              </>
            )}
          </span>
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
