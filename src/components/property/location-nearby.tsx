import { HeartPulse, GraduationCap, Briefcase, ShoppingCart, Bus, MapPin } from "lucide-react";
import type { ProximityCategory, Property } from "@/lib/types";
import type { MapMarker } from "@/components/property-map";
import { PropertyMap } from "@/components/property-map-lazy";

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
  const hasProximities = (property.proximities?.length ?? 0) > 0;

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
            {property.proximities!.map((p) => {
              const meta = PROXIMITY_META[p.category];
              const Icon = meta?.icon ?? MapPin;
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
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
