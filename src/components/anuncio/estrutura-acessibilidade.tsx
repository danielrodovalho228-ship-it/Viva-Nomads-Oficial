"use client";

import { useEffect, useRef, useState } from "react";
import { BlocoOpcional } from "@/components/anuncio/bloco-opcional";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import { nasceLigado } from "@/lib/anuncio/bloco-opcional";
import { lerChecklistEstrutura, salvarChecklistEstrutura } from "@/lib/data/estrutura-actions";
import { GRUPOS_ESTRUTURA, ITENS_ESTRUTURA, NOTA_ESTRUTURA_INFORMADA, temEstruturaInformada, type ChecklistEstrutura, type ItemChecklist } from "@/lib/selos-estrutura";
import { semQuedaDeRede } from "@/lib/erro-de-rede";

/** E258 (c): aqui não há botão — cada toque grava; a tela diz isso antes do primeiro toque. */
export const COMO_SALVA_ESTRUTURA = "Cada toque salva na hora.";

/**
 * E225-A — "O imóvel tem estrutura de acessibilidade?" (padrão E56), no fim do Passo 5 e no editar. Ligado, abre os
 * 8 itens em dois grupos (Acessibilidade e Mobilidade reduzida), cada um num cartão de marcar com a linha de critério. Cada toque
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
    const r = await semQuedaDeRede(salvarChecklistEstrutura(propertyId, novo));
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
              {/* E193 (reteste de 30/10): cada item no cartão grande da Qualificação (antes, um interruptor por linha). */}
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {g.itens.map((item) => (
                  <li key={item}>
                    <CartaoEscolha
                      papel="checkbox"
                      on={checklist[item] === true}
                      onClick={() => marcar(item, checklist[item] !== true)}
                      disabled={estado === "salvando"}
                      testid={`estrutura-item-${item}`}
                      rotulo={ITENS_ESTRUTURA[item].rotulo}
                      dica={ITENS_ESTRUTURA[item].criterio}
                      className="h-full"
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
          <p className="text-xs text-muted" data-testid="estrutura-nota">
            No anúncio: “{NOTA_ESTRUTURA_INFORMADA}”
          </p>
          <p className="text-xs" role="status" aria-live="polite" data-testid="estrutura-como-salva">
            {estado === "" && <span className="text-muted">{COMO_SALVA_ESTRUTURA}</span>}
            {estado === "salvando" && <span className="text-muted">Salvando…</span>}
            {estado === "salvo" && <span className="text-forest">Salvo.</span>}
            {estado === "erro" && <span className="text-red-700">Não foi possível salvar agora. Tente de novo.</span>}
          </p>
        </div>
      </BlocoOpcional>
    </div>
  );
}
