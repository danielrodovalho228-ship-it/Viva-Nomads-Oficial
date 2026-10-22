"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BrandImage } from "@/components/brand-image";
import { cn } from "@/lib/utils";

/** Fotos do cartão (adendo do Prompt 40): carrossel 4:3 que desliza com o dedo, com pontos. Até 5 fotos. */
export const MAX_FOTOS_CARTAO = 5;

/**
 * Fica DENTRO do link do cartão: nada clicável aqui (botão dentro de <a> é HTML inválido — D12).
 * Os pontos só mostram a posição; as setas do computador ficam fora do link (SetasFotos).
 */
export function FotosCartao({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [ativo, setAtivo] = useState(0);
  const lista = fotos.slice(0, MAX_FOTOS_CARTAO);
  return (
    <>
      <div
        data-fotos=""
        {...(lista.length > 1 ? { tabIndex: 0, role: "group", "aria-label": "Fotos do imóvel (use as setas para rolar)" } : {})}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtivo(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lista.map((src, i) => (
          <BrandImage
            key={`${src}-${i}`}
            src={src}
            alt={i === 0 ? alt : `${alt} — foto ${i + 1}`}
            rounded="rounded-none"
            treat={false}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="h-full w-full shrink-0 snap-start"
          />
        ))}
      </div>
      {lista.length > 1 && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1" data-testid="cartao-pontos">
          {lista.map((_, i) => (
            <span key={i} className={cn("h-2 w-2 rounded-full bg-white", i === ativo ? "opacity-100" : "opacity-60")} data-ativo={i === ativo ? "1" : undefined} />
          ))}
        </div>
      )}
    </>
  );
}

/** Setas do carrossel no computador (fora do link): aparecem ao passar o mouse no cartão. */
export function SetasFotos() {
  function mover(e: React.MouseEvent<HTMLButtonElement>, lado: 1 | -1) {
    const fotos = e.currentTarget.closest('[data-testid="cartao-imovel"]')?.querySelector<HTMLElement>("[data-fotos]");
    fotos?.scrollBy({ left: lado * fotos.clientWidth, behavior: "smooth" });
  }
  const cls =
    "pointer-events-auto hidden h-8 w-8 place-items-center rounded-full bg-white text-ink opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 lg:grid";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex aspect-[4/3] items-center justify-between px-2">
      <button type="button" aria-label="Foto anterior" onClick={(e) => mover(e, -1)} className={cls}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" aria-label="Próxima foto" onClick={(e) => mover(e, 1)} className={cls}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
