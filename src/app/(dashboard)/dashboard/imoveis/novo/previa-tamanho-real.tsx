"use client";

import { useEffect, useState } from "react";
import { Maximize2, MapPin, X } from "lucide-react";
import { PropertyGallery } from "@/components/property-gallery";
import { PriceCard } from "@/components/property/price-card";
import { linhaLocalizacao } from "@/lib/localizacao";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * E161: "Ver no tamanho real" — o anúncio como o morador vai ver, com as PEÇAS da página do imóvel (a galeria e o cartão
 * de preço) na MESMA régua dela (1536 px, px-4/sm:px-8, coluna lateral 22rem/26rem). No computador a prévia lateral
 * do assistente tem a largura do cartão lateral do anúncio; a foto no tamanho real (480 px de altura, a coluna inteira)
 * só cabe aqui, por cima do assistente. No celular, onde não há prévia lateral, é o único caminho para ver o anúncio.
 */
export function BotaoTamanhoReal({ imovel, className }: { imovel: Property; className?: string }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", fechar);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fechar);
      document.body.style.overflow = antes;
    };
  }, [aberto]);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={cn("inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest underline underline-offset-4", className)}
        data-testid="previa-tamanho-real-abrir"
      >
        <Maximize2 className="h-4 w-4" aria-hidden /> Ver no tamanho real
      </button>
      {aberto && (
        <div role="dialog" aria-modal="true" aria-label="O anúncio no tamanho real" className="fixed inset-0 z-50 overflow-y-auto bg-white" data-testid="previa-tamanho-real">
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between gap-2 border-b border-line bg-white px-4 sm:px-8">
            <p className="text-sm font-semibold text-ink">Assim o morador vê o seu anúncio</p>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-ink hover:bg-surface-2"
              data-testid="previa-tamanho-real-fechar"
            >
              <X className="h-5 w-5" aria-hidden /> Fechar
            </button>
          </div>
          {/* A régua da página do imóvel (property-detail, imovel-largura-total). */}
          <div className="mx-auto w-full max-w-[1536px] px-4 py-8 sm:px-8" data-testid="previa-real-largura">
            <PropertyGallery photos={imovel.photos} title={imovel.title} readyToLive={imovel.readyToLiveBadge} />
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-12">
              <header className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <MapPin className="h-4 w-4" /> {linhaLocalizacao(imovel.neighborhood, imovel.city, imovel.state)}
                </div>
                <h1 className="mt-2 text-2xl font-semibold text-ink lg:text-[28px]">{imovel.title}</h1>
              </header>
              <aside data-testid="previa-real-cartao">
                <PriceCard
                  property={imovel}
                  actions={<p className="text-xs text-muted">Aqui o morador vê o botão “Solicitar”.</p>}
                />
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
