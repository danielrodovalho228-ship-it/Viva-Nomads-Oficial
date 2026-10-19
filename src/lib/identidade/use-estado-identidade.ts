"use client";

import { useCallback, useEffect, useState } from "react";
import type { EstadoIdentidade } from "@/lib/identidade/estado";

export interface SituacaoIdentidade {
  identidade: EstadoIdentidade;
  temCpf: boolean;
  teste: boolean;
}

/**
 * O estado da identidade da PRÓPRIA pessoa no navegador (complemento do prompt 23): lê /api/caf/status, que devolve
 * o estado único (estadoIdentidadeDe). null = carregando. Sem resposta, cai em null e a tela mostra o carregando.
 */
export function useEstadoIdentidade(): { situacao: SituacaoIdentidade | null; recarregar: () => Promise<void> } {
  const [situacao, setSituacao] = useState<SituacaoIdentidade | null>(null);
  const recarregar = useCallback(async () => {
    const d = (await fetch("/api/caf/status")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as (Partial<SituacaoIdentidade> & { identidade?: EstadoIdentidade }) | null;
    if (d?.identidade) setSituacao({ identidade: d.identidade, temCpf: d.temCpf === true, teste: d.teste === true });
  }, []);
  useEffect(() => {
    let vivo = true;
    fetch("/api/caf/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: (Partial<SituacaoIdentidade> & { identidade?: EstadoIdentidade }) | null) => {
        if (vivo && d?.identidade) setSituacao({ identidade: d.identidade, temCpf: d.temCpf === true, teste: d.teste === true });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return { situacao, recarregar };
}
