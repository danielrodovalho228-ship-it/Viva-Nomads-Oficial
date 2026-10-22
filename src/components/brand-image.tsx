import Image from "next/image";
import { BRAND_BLUR } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Imagem com tratamento de marca: enquadramento padronizado, blur placeholder
 * (sem CLS) e leve duotone azul para unificar a fotografia. Usa next/image.
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
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", raio, className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={BRAND_BLUR}
        className={fit}
      />
      {treat && (
        <div className="pointer-events-none absolute inset-0 bg-night/20" />
      )}
    </div>
  );
}
