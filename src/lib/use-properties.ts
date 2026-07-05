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
// Cache em memória (por sessão): evita re-piscar o loading e refazer o mesmo
// fetch a cada navegação entre telas do painel. Sempre revalida em 2º plano.
const cache = new Map<string, Property[]>();

/** Limpa o cache (chamado no login p/ não vazar dados entre contas na mesma aba). */
export function resetPropertiesCache() {
  cache.clear();
}

export function useProperties(endpoint: "/api/properties" | "/api/properties/mine") {
  const [properties, setProperties] = useState<Property[]>(() => cache.get(endpoint) ?? []);
  // Só "carregando" na 1ª vez (sem cache); depois usa o cache na hora.
  const [loading, setLoading] = useState(() => !cache.has(endpoint));

  useEffect(() => {
    let alive = true;
    if (cache.has(endpoint)) {
      setProperties(cache.get(endpoint)!);
      setLoading(false);
    } else {
      setLoading(true);
    }
    // Revalida SEMPRE em segundo plano (dado fresco sem travar a navegação).
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.properties)) {
          cache.set(endpoint, d.properties as Property[]);
          setProperties(d.properties as Property[]);
        }
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
