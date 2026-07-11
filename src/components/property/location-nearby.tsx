import { HeartPulse, GraduationCap, Briefcase, ShoppingCart, Bus, MapPin } from "lucide-react";
import type { ProximityCategory, Property } from "@/lib/types";
import type { MapMarker } from "@/components/property-map";
import { PropertyMap } from "@/components/property-map-lazy";

/**
 * Distância APROXIMADA para o anúncio público (item 2 do QA): arredonda os
 * minutos para o múltiplo de 5 mais próximo (mín. 5) e prefixa "~", para não
 * dar precisão que ajude a triangular o endereço antes do aceite. Sem minutos
 * no texto (ex.: "a pé"), devolve nada — evita combinação hiperespecífica.
 */
function distanciaAprox(note?: string): string | undefined {
  if (!note) return undefined;
  const m = note.match(/(\d+)\s*min/i);
  if (!m) return undefined;
  const min = parseInt(m[1], 10);
  if (!Number.isFinite(min)) return undefined;
  const arred = Math.max(5, Math.round(min / 5) * 5);
  const modo = /p[ée]/i.test(note) ? " a pé" : /carro|autom[óo]vel|dirig/i.test(note) ? " de carro" : "";
  return `~${arred} min${modo}`;
}

const PROXIMITY_META: Record<ProximityCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  saude: { label: "Saúde", icon: HeartPulse },
  educacao: { label: "Educação", icon: GraduationCap },
  trabalho: { label: "Trabalho", icon: Briefcase },
  mercado: { label: "Mercado", icon: ShoppingCart },
  transporte: { label: "Transporte", icon: Bus },
};

/**
 * Localização: mapa da REGIÃO aproximada (endereço exato só após o aceite — regra
 * de privacidade preservada) + lista de proximidades úteis. Se não houver
 * proximidades cadastradas, mostra só o mapa e o aviso de privacidade.
 */
export function LocationNearby({ property }: { property: Property }) {
  const marker: MapMarker = {
    id: property.id,
    lat: property.lat,
    lng: property.lng,
    label: "Imóvel",
    kind: "property",
  };
  // Antes do aceite, limitamos os POIs exibidos para não re-identificar o
  // endereço por combinação (item 4 do QA): no máximo 4, sem a lista completa.
  const MAX_POIS_PUBLICOS = 4;
  const todosProximities = property.proximities ?? [];
  const proximities = todosProximities.slice(0, MAX_POIS_PUBLICOS);
  const ocultos = todosProximities.length - proximities.length;
  const hasProximities = proximities.length > 0;

  return (
    <section aria-labelledby="localizacao-title">
      <h2 id="localizacao-title" className="font-title text-2xl font-bold text-ink">
        Localização
      </h2>

      <PropertyMap
        className="mt-5 aspect-[16/9] w-full"
        center={{ lat: property.lat, lng: property.lng }}
        markers={[marker]}
        approximate
      />
      <p className="mt-3 flex items-start gap-1.5 text-sm text-muted">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        Mostramos a <strong className="mx-1 text-ink">região aproximada</strong> (
        {property.neighborhood}). O endereço exato é liberado após o aceite da candidatura.
      </p>

      {hasProximities && (
        <>
          <h3 className="mt-6 text-sm font-bold text-forest">O que tem por perto</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {proximities.map((p) => {
              const meta = PROXIMITY_META[p.category];
              const Icon = meta?.icon ?? MapPin;
              const dist = distanciaAprox(p.note);
              return (
                <li
                  key={`${p.category}-${p.name}`}
                  className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3"
                >
                  <Icon className="h-5 w-5 shrink-0 text-sage" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {meta?.label ?? p.category}
                      {dist ? ` · ${dist}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {ocultos > 0 && (
            <p className="mt-2 text-xs text-muted">
              +{ocultos} ponto(s) de interesse revelados após o aceite da candidatura.
            </p>
          )}
        </>
      )}
    </section>
  );
}
