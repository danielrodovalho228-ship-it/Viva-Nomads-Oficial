"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Imagem do topo dos cards de "Como funciona".
 * Usa next/image (otimização + lazy loading). Enquanto o arquivo não existe,
 * cai para um placeholder de marca (sem imagem quebrada). Assim que a imagem
 * é enviada para /public/images/como-funciona/, aparece automaticamente.
 */
export function StepImage({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  /** Carrega de imediato (cards acima da dobra) — evita imagem em branco. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="aspect-[3/2] w-full bg-gradient-to-br from-blue-100 via-surface-2 to-green-100" />
    );
  }

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface-2">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
