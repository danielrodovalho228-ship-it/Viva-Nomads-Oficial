"use client";

import { useEffect, useState } from "react";
import type { Property } from "@/lib/types";

/**
 * Busca imóveis REAIS para telas client (visão geral, favoritos, comparar,
 * orçamentos), via rotas de API que usam a camada de dados no servidor.
 *
 * - "/api/properties"      → públicos ativos (favoritos/comparar/recomendados)
 * - "/api/properties/mine" → do proprietário logado (visão geral/orçamentos)
 *
 * Começa vazio (sem piscar imóvel fictício no modo real). No modo demonstração
 * a própria rota devolve os exemplos.
 */
export function useProperties(endpoint: "/api/properties" | "/api/properties/mine") {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.properties)) setProperties(d.properties as Property[]);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [endpoint]);

  return { properties, loading };
}
