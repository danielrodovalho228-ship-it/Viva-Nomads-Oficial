"use client";

import { HeartPulse, GraduationCap, Briefcase, ShoppingCart, Bus, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import type { MapMarker } from "@/components/property-map";
import { PropertyMap } from "@/components/property-map-lazy";
import { CLASSE_ICONE_LISTA, TRACO_ICONE_LISTA } from "@/lib/anuncio/comodidades-icones";
import type { ProximityCategory } from "@/lib/types";
import type { LocalDaEstadia } from "@/lib/data/estadia-local";

const ICONE: Record<ProximityCategory, { label: string; icon: LucideIcon }> = {
  saude: { label: "Saúde", icon: HeartPulse },
  educacao: { label: "Educação", icon: GraduationCap },
  trabalho: { label: "Trabalho", icon: Briefcase },
  mercado: { label: "Mercado", icon: ShoppingCart },
  transporte: { label: "Transporte", icon: Bus },
};

/**
 * Prompt 61-A, item 2 — o local na página da estadia: o mapa e as proximidades do anúncio (mesma lista do bloco do
 * Prompt 37). Com as duas assinaturas, o ponto exato e o endereço com "Abrir no mapa"; antes, a região aproximada,
 * como no anúncio.
 */
export function LocalEstadia({ local, imovelId }: { local: LocalDaEstadia; imovelId: string }) {
  const exato = !!local.endereco;
  const marker: MapMarker = { id: imovelId, lat: local.lat, lng: local.lng, label: "Imóvel", kind: "property" };
  return (
    <Panel title="Local" data-testid="estadia-local" data-exato={exato ? "1" : "0"}>
      <PropertyMap className="aspect-[16/9] w-full" center={{ lat: local.lat, lng: local.lng }} markers={[marker]} approximate={!exato} />
      {local.endereco ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-ink" data-testid="estadia-endereco">
          <MapPin className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden />
          <span className="min-w-0">
            {local.endereco.texto}{" "}
            <a href={local.endereco.mapa} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-2" data-testid="estadia-abrir-mapa">
              Abrir no mapa
            </a>
          </span>
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted" data-testid="estadia-regiao">
          <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Região aproximada{local.bairro ? ` (${local.bairro})` : ""}. O endereço exato aparece aqui quando as duas partes assinarem o contrato.
          </span>
        </p>
      )}
      {local.proximidades.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-ink">O que tem por perto</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="estadia-proximidades">
            {local.proximidades.map((p) => {
              const meta = ICONE[p.categoria];
              const Icon = meta?.icon ?? MapPin;
              return (
                <li key={`${p.categoria}-${p.nome}`} className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3">
                  <Icon className={CLASSE_ICONE_LISTA} strokeWidth={TRACO_ICONE_LISTA} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{p.nome}</span>
                    <span className="block text-xs text-muted">
                      {meta?.label ?? p.categoria} · {p.texto}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
