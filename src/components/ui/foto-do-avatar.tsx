"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * E698 — a foto do avatar entra SOBRE as iniciais, com fade, só depois de carregada. Antes ela aparecia vazia/quebrada
 * enquanto baixava e o círculo alternava entre inicial e foto. Se a foto falhar, ficam as iniciais (nunca um buraco).
 */
export function FotoDoAvatar({ src, className }: { src: string; className?: string }) {
  const [carregada, setCarregada] = useState(false);
  const [falhou, setFalhou] = useState(false);
  if (falhou) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar pequeno, tamanho fixo, URL assinada/rota própria
    <img
      src={src}
      alt=""
      onLoad={() => setCarregada(true)}
      onError={() => setFalhou(true)}
      className={cn("absolute inset-0 h-full w-full rounded-full object-cover transition-opacity duration-300", carregada ? "opacity-100" : "opacity-0", className)}
    />
  );
}
