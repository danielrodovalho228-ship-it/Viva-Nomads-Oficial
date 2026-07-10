"use client";

import { useEffect, useState } from "react";
import { getMinhasLocacoes } from "@/lib/data/contratos-actions";

/**
 * O inquilino tem alguma locação ATIVA? Usado para revelar "Solicitações" no
 * menu só quando faz sentido (antes disso, o card vive dentro de Minhas
 * locações). `enabled=false` evita a chamada quando não é o modo inquilino.
 */
export function useHasActiveLocacao(enabled: boolean): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    let alive = true;
    getMinhasLocacoes()
      .then((ls) => {
        if (alive) setActive(ls.some((l) => l.status === "ativo"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return active;
}
