"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper que carrega o PropertyMap (mapbox-gl, ~200 KB) sob demanda. Assim o
 * mapbox não entra no bundle inicial da página do imóvel — o mapa aparece com um
 * placeholder enquanto o script carrega. `ssr: false` porque é 100% navegador.
 */
export const PropertyMap = dynamic(
  () => import("@/components/property-map").then((m) => m.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-surface-2" />
    ),
  }
);
