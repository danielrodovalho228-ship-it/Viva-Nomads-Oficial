"use client";

import { useEffect } from "react";
import { Eye, MessageCircle } from "lucide-react";
import { useMarcasStore } from "@/lib/marcas/store";
import { rotuloMarca } from "@/lib/marcas/regra";

/** Selo discreto no cartão: "Visto" ou "Você já contatou" (só para quem está logado e já fez isso). */
export function MarcaImovel({ propertyId }: { propertyId: string }) {
  const carregar = useMarcasStore((s) => s.carregar);
  const marca = useMarcasStore((s) => s.porImovel[propertyId]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const rotulo = rotuloMarca(marca);
  if (!rotulo) return null;
  const Icone = rotulo === "Visto" ? Eye : MessageCircle;
  return (
    <span
      data-testid="marca-imovel"
      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-ink"
    >
      <Icone className="h-3 w-3" aria-hidden /> {rotulo}
    </span>
  );
}
