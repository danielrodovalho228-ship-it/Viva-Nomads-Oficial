"use client";

import { useEffect, useRef, useState } from "react";
import { BlocoOpcional } from "@/components/anuncio/bloco-opcional";
import { nasceLigado } from "@/lib/anuncio/bloco-opcional";
import { lerChecklistEstrutura, salvarChecklistEstrutura } from "@/lib/data/estrutura-actions";
import { GRUPOS_ESTRUTURA, ITENS_ESTRUTURA, NOTA_ESTRUTURA_INFORMADA, temEstruturaInformada, type ChecklistEstrutura, type ItemChecklist } from "@/lib/selos-estrutura";
import { cn } from "@/lib/utils";

/**
 * E225-A — "O imóvel tem estrutura de acessibilidade?" (padrão E56), no fim do Passo 5 e no editar. Ligado, abre os
 * 8 itens em dois grupos (Acessibilidade e Mobilidade reduzida), cada um com sim/não e a linha de critério. Cada toque
 * grava na hora (salvarChecklistEstrutura). Desligar apaga o que foi marcado. No anúncio, só os itens "sim" aparecem,
 * em texto, como "Estrutura informada pelo proprietário" — sem selo (o selo pede prova de cada item, E225-B).
 */
export function EstruturaAcessibilidade({ propertyId }: { propertyId: string }) {
  const [checklist, setChecklist] = useState<ChecklistEstrutura>({});
  const [ligado, setLigado] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | "erro">("");
  const ultimo = useRef<ChecklistEstrutura>({});

  useEffect(() => {
    let vivo = true;
    void lerChecklistEstrutura(propertyId).then((r) => {
      if (!vivo) return;
      const c = r.ok ? r.checklist : {};
      ultimo.current = c;
      setChecklist(c);
      setLigado(nasceLigado(temEstruturaInformada(c)));
      setCarregado(true);
    });
    return () => {
      vivo = false;
    };
  }, [propertyId]);

  async function gravar(novo: ChecklistEstrutura) {
    setChecklist(novo);
    setEstado("salvando");
    const r = await salvarChecklistEstrutura(propertyId, novo);
    if (r.ok) {
      ultimo.current = novo;
      setEstado("salvo");
    } else {
      // Volta ao que estava gravado: a tela nunca mostra um "sim" que não foi salvo.
      setChecklist(ultimo.current);
      setEstado("erro");
    }
  }

  const marcar = (item: ItemChecklist, sim: boolean) => void gravar({ ...checklist, [item]: sim });

  if (!carregado) return null;
  return (
    <div data-testid="estrutura-acessibilidade" data-estado={estado}>
      <BlocoOpcional
        id="estrutura"
        titulo="O imóvel tem estrutura de acessibilidade?"
        descricao="Opcional. O que você marcar aparece no anúncio como informado por você, para o morador confirmar na visita."
        ligado={ligado}
        temDados={temEstruturaInformada(checklist)}
        onLigar={() => setLigado(true)}
        onDesligar={() => {
          setLigado(false);
          void gravar({});
        }}
      >
        <div className="space-y-6">
          {GRUPOS_ESTRUTURA.map((g) => (
            <fieldset key={g.id} data-testid={`estrutura-grupo-${g.id}`}>
              <legend className="text-sm font-semibold text-ink">{g.titulo}</legend>
              <ul className="mt-2 divide-y divide-line">
                {g.itens.map((item) => {
                  const sim = checklist[item] === true;
                  return (
                    <li key={item} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p id={`estrutura-${item}-rotulo`} className="text-sm text-ink">
                          {ITENS_ESTRUTURA[item].rotulo}
                        </p>
                        <p className="mt-1 text-xs text-muted">{ITENS_ESTRUTURA[item].criterio}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sim}
                        aria-labelledby={`estrutura-${item}-rotulo`}
                        onClick={() => marcar(item, !sim)}
                        disabled={estado === "salvando"}
                        data-testid={`estrutura-item-${item}`}
                        className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60", sim ? "bg-forest" : "bg-sage-200")}
                      >
                        <span className={cn("inline-block h-5 w-5 rounded-full bg-white transition-transform", sim ? "translate-x-6" : "translate-x-1")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
          <p className="text-xs text-muted" data-testid="estrutura-nota">
            No anúncio: “{NOTA_ESTRUTURA_INFORMADA}”
          </p>
          <p className="text-xs" role="status" aria-live="polite">
            {estado === "salvando" && <span className="text-muted">Salvando…</span>}
            {estado === "salvo" && <span className="text-forest">Salvo.</span>}
            {estado === "erro" && <span className="text-red-700">Não foi possível salvar agora. Tente de novo.</span>}
          </p>
        </div>
      </BlocoOpcional>
    </div>
  );
}
