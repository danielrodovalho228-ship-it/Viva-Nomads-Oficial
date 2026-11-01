"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { BRAND_BLUR } from "@/lib/media";
import { cn } from "@/lib/utils";
import { proximaTentativa, ROTULO_FOTO_INDISPONIVEL, type TentativaImagem } from "@/lib/fotos/tentativa-imagem";

/**
 * Imagem com tratamento de marca: enquadramento padronizado, blur placeholder
 * (sem CLS) e leve duotone azul para unificar a fotografia. Usa next/image.
 * E323: se a imagem falhar, tenta de novo direto da origem (sem o otimizador) e, se falhar outra vez, mostra
 * "Foto indisponível" — nunca o quadro em branco.
 */
export function BrandImage({
  src,
  alt,
  className,
  priority = false,
  sizes = "100vw",
  treat = true,
  rounded: raio = "rounded-xl",
  fit = "object-cover",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  treat?: boolean;
  rounded?: string;
  /** Classe de ajuste da foto: "object-contain" mostra inteira, sem cortar. */
  fit?: string;
}) {
  // A tentativa vale para ESTA foto: trocar o src recomeça do otimizado.
  const [estado, setEstado] = useState<{ src: string; tentativa: TentativaImagem }>({ src, tentativa: "otimizada" });
  const tentativa = estado.src === src ? estado.tentativa : "otimizada";
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", raio, className)}>
      {tentativa === "falhou" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted" role="img" aria-label={alt || ROTULO_FOTO_INDISPONIVEL} data-testid="foto-indisponivel">
          <ImageOff className="h-6 w-6" aria-hidden />
          <span className="text-xs">{ROTULO_FOTO_INDISPONIVEL}</span>
        </div>
      ) : (
        <Image
          key={tentativa}
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          // E259 (10): no Next 16 o `priority` foi descontinuado; a forma indicada para a foto da primeira pintura é
          // carregar já e com prioridade alta de rede.
          {...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
          placeholder="blur"
          blurDataURL={BRAND_BLUR}
          className={fit}
          unoptimized={tentativa === "direta"}
          data-tentativa={tentativa}
          onError={() => setEstado({ src, tentativa: proximaTentativa(tentativa) })}
        />
      )}
      {treat && tentativa !== "falhou" && (
        <div className="pointer-events-none absolute inset-0 bg-night/20" />
      )}
    </div>
  );
}
