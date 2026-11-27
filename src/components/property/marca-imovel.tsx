"use client";

import { useEffect } from "react";
import { Eye, MessageCircle } from "lucide-react";
import { useMarcasStore } from "@/lib/marcas/store";
import { rotuloMarca } from "@/lib/marcas/regra";

/*
  Estado do usuário no cartão: "Visto" ou "Você já contatou" (só para quem está logado e já fez isso).
  E643: é um ESTADO, não um selo do imóvel. Fica no texto do cartão (abaixo da disponibilidade), FORA da foto: a foto guarda só
  as até 2 pílulas do desenho aprovado (E626). Antes era uma 3ª pílula branca no canto inferior da foto.
*/
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
      className="inline-flex items-center gap-1 text-xs font-medium text-apoio"
    >
      <Icone className="h-3.5 w-3.5" aria-hidden /> {rotulo}
    </span>
  );
}
