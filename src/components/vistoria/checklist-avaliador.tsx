"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GRUPOS_AVALIACAO, ITENS_CHECKLIST, ROTULO_VALOR, valoresDoItem, type ItemChecklist, type ValorItem } from "@/config/checklist-avaliacao";
import { salvarItens } from "@/lib/vistoria/laudo-actions";

type Pendente = { chave: string; valor: ValorItem; observacao: string | null };
const ITENS = ITENS_CHECKLIST as readonly ItemChecklist[];

function lerFila(chave: string): Pendente[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(chave) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function gravarFila(chave: string, fila: Pendente[]) {
  try {
    if (fila.length) window.localStorage.setItem(chave, JSON.stringify(fila));
    else window.localStorage.removeItem(chave);
  } catch {
    /* sem armazenamento local: o envio segue item a item */
  }
}

/**
 * Checklist da avaliação no celular do avaliador (Prompt 62-B2, ESQUELETO; o desenho é do 62-A). Salva a cada item.
 * Rede ruim: a resposta fica na fila do aparelho e vai quando a conexão volta, com o aviso do que falta enviar.
 */
export function ChecklistAvaliador({ pedidoId, iniciais }: { pedidoId: string; iniciais: Record<string, { valor: ValorItem; observacao: string | null }> }) {
  const chaveFila = `vn-avaliacao-fila-${pedidoId}`;
  const [respostas, setRespostas] = useState<Record<string, { valor: ValorItem; observacao: string | null }>>(iniciais);
  const [fila, setFila] = useState<Pendente[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useCallback(
    async (lote: Pendente[]) => {
      if (!lote.length) return;
      setEnviando(true);
      const f = new FormData();
      f.set("pedidoId", pedidoId);
      f.set("itens", JSON.stringify(lote));
      let ok = false;
      try {
        const r = await salvarItens(f);
        ok = r.ok;
        setErro(r.ok ? null : r.erro);
      } catch {
        setErro("Sem conexão: a resposta ficou guardada no aparelho.");
      }
      setEnviando(false);
      const resto = ok ? lerFila(chaveFila).filter((p) => !lote.some((x) => x.chave === p.chave && x.valor === p.valor)) : lerFila(chaveFila);
      gravarFila(chaveFila, resto);
      setFila(resto);
    },
    [chaveFila, pedidoId],
  );

  useEffect(() => {
    // A fila que ficou no aparelho (rede caiu antes): reenvia ao abrir e quando a conexão volta.
    const reenviar = () => {
      const guardada = lerFila(chaveFila);
      if (guardada.length) void enviar(guardada);
    };
    const t = window.setTimeout(reenviar, 0);
    window.addEventListener("online", reenviar);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("online", reenviar);
    };
  }, [chaveFila, enviar]);

  function responder(chave: string, valor: ValorItem, observacao: string | null) {
    setRespostas((r) => ({ ...r, [chave]: { valor, observacao } }));
    const nova = [...lerFila(chaveFila).filter((p) => p.chave !== chave), { chave, valor, observacao }];
    gravarFila(chaveFila, nova);
    setFila(nova);
    void enviar([{ chave, valor, observacao }]);
  }

  const faltam = useMemo(() => ITENS.filter((i) => !respostas[i.chave]).length, [respostas]);

  return (
    <div data-testid="checklist-avaliador">
      <p className="text-sm text-ink" data-testid="checklist-faltam" data-faltam={faltam}>
        {faltam === 0 ? "Checklist completo." : `Faltam ${faltam} de ${ITENS.length} itens.`}
      </p>
      {fila.length > 0 && (
        <p className="mt-1 text-sm text-amber-700" role="status" data-testid="checklist-fila" data-pendentes={fila.length}>
          {fila.length === 1 ? "1 resposta aguardando envio" : `${fila.length} respostas aguardando envio`}
          {enviando ? " (enviando…)" : ""}.{" "}
          <button type="button" className="underline" onClick={() => void enviar(lerFila(chaveFila))}>
            Enviar agora
          </button>
        </p>
      )}
      {erro && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}
      {GRUPOS_AVALIACAO.map((g) => (
        <fieldset key={g.id} className="mt-4 rounded-lg border border-sage-200 p-3" data-testid="checklist-grupo" data-grupo={g.id}>
          <legend className="px-1 font-title text-base font-semibold text-ink">{g.rotulo}</legend>
          <ul className="grid gap-3">
            {ITENS.filter((i) => i.grupo === g.id).map((i) => {
              const atual = respostas[i.chave];
              return (
                <li key={i.chave} className="text-sm" data-testid="checklist-item" data-chave={i.chave} data-valor={atual?.valor ?? ""}>
                  <p className="font-semibold text-ink">
                    {i.rotulo}
                    {i.testeEmUso ? " · teste em uso" : ""}
                    {i.grave ? " · segurança" : ""}
                  </p>
                  <p className="text-xs text-muted">{i.criterio}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {valoresDoItem(i).map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={atual?.valor === v ? "primary" : "secondary"}
                        aria-pressed={atual?.valor === v}
                        data-testid={`item-${i.chave}-${v}`}
                        onClick={() => responder(i.chave, v, atual?.observacao ?? null)}
                      >
                        {ROTULO_VALOR[v]}
                      </Button>
                    ))}
                  </div>
                  {atual && ["nao_conforme", "leve", "nao_habitavel"].includes(atual.valor) && (
                    <input
                      defaultValue={atual.observacao ?? ""}
                      placeholder="O que está não conforme (sem nomes nem dados pessoais)"
                      aria-label={`Observação: ${i.rotulo}`}
                      maxLength={300}
                      className="mt-2 w-full rounded-lg border border-sage-200 px-3 py-2 text-base"
                      onBlur={(e) => e.target.value !== (atual.observacao ?? "") && responder(i.chave, atual.valor, e.target.value || null)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}
