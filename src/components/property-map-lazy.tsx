"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper que carrega o PropertyMap (mapbox-gl, ~200 KB) sob demanda. Assim o
 * mapbox não entra no bundle inicial da página do imóvel — o mapa aparece com um
 * placeholder enquanto o script carrega. `ssr: false` porque é 100% navegador.
 */
export const PropertyMap = dynamic(
  () =>
    import("@/components/property-map")
      .then((m) => m.PropertyMap)
      // E419: o script do mapa não baixou (rede/atualização do site) → o aviso, em vez de derrubar a página.
      .catch(() => MapaNaoCarregou),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-surface-2" />
    ),
  }
);

/** E419: o próprio script do mapa não carregou — o aviso e "Tentar de novo" (recarrega a página). */
function MapaNaoCarregou({ className }: { className?: string }) {
  return (
    <div role="status" data-testid="mapa-indisponivel" className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 p-4 text-center text-sm text-muted ${className ?? ""}`}>
      <p>Não foi possível carregar o mapa agora. A localização aproximada continua descrita nesta página.</p>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white px-4 font-medium text-ink hover:bg-surface-2" data-testid="mapa-tentar-de-novo">
        Tentar de novo
      </button>
    </div>
  );
}
