"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { servicosPorPerto } from "@/lib/anuncio/proximidades";
import type { Proximity } from "@/lib/types";

/**
 * Serviços por perto (adendo do prompt 37): Ônibus · Mercado · Farmácia. Cada chip mostra o tempo aproximado até o
 * mais perto, sem o nome do lugar (privacidade antes do aceite). Serviço sem dado não aparece.
 */
export function ServicosPorPerto({ proximidades }: { proximidades: Proximity[] }) {
  const servicos = servicosPorPerto(proximidades);
  const [ativo, setAtivo] = useState(servicos[0]?.tipo ?? null);
  if (servicos.length === 0) return null;
  const atual = servicos.find((s) => s.tipo === ativo);
  return (
    <div className="mt-6" data-testid="servicos-por-perto">
      <h3 className="text-sm font-semibold text-forest">Serviços por perto</h3>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Serviços por perto">
        {servicos.map((s) => (
          <Chip key={s.tipo} ativo={ativo === s.tipo} data-testid={`servico-${s.tipo}`} onClick={() => setAtivo(s.tipo)}>
            {s.rotulo}
          </Chip>
        ))}
      </div>
      {atual && (
        <p className="mt-3 text-sm text-ink" data-testid="servico-resultado" aria-live="polite">
          {atual.texto}
        </p>
      )}
    </div>
  );
}
