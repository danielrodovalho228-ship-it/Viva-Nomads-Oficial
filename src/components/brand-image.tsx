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
  rounded = "rounded-2xl",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  treat?: boolean;
  rounded?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-blue-900", rounded, className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={BRAND_BLUR}
        className="object-cover"
      />
      {treat && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-blue-900/45 via-transparent to-transparent" />
      )}
    </div>
  );
}
