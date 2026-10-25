"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { GRUPOS_AVALIACAO, ITENS_CHECKLIST, ROTULO_VALOR, valoresDoItem, type GrupoAvaliacao, type ItemChecklist, type ValorItem } from "@/config/checklist-avaliacao";
import { enviarFotoAvaliacao, salvarItens } from "@/lib/vistoria/laudo-actions";
import { AVISO_SEM_PESSOAS, TEXTO_TESTE_EM_USO, passosDoChecklist, pedeFotoDoItem, rotuloPasso, textoFaltaFotos } from "@/lib/vistoria/telas-laudo";

type Pendente = { chave: string; valor: ValorItem; observacao: string | null };
type FotoNaFila = { id: string; chave: string; arquivo: File };
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
 * Checklist da avaliação no celular do avaliador (62-B2; desenho do 62-A, Parte 2, item 8): os 9 grupos em passos, item a
 * item com "conforme / não conforme / não se aplica" (botões de 44 px), o critério em uma linha, os testes em uso
 * destacados, a câmera só no item não conforme (1 foto por item não conforme), a medição da internet e o ruído no próprio
 * passo (`extras`), o aviso "sem pessoas, sem pertences", o progresso salvo a cada item e, sem rede, o que falta enviar:
 * as respostas ficam na fila do aparelho e as fotos esperam a conexão voltar.
 */
export function ChecklistAvaliador({
  pedidoId,
  iniciais,
  extras = {},
}: {
  pedidoId: string;
  iniciais: Record<string, { valor: ValorItem; observacao: string | null }>;
  extras?: Partial<Record<GrupoAvaliacao, React.ReactNode>>;
}) {
  const chaveFila = `vn-avaliacao-fila-${pedidoId}`;
  const [respostas, setRespostas] = useState<Record<string, { valor: ValorItem; observacao: string | null }>>(iniciais);
  const [fila, setFila] = useState<Pendente[]>([]);
  const [fotos, setFotos] = useState<FotoNaFila[]>([]);
  const [fotosEnviadas, setFotosEnviadas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoFotos = useRef(false);

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

  // Fotos: uma de cada vez; a que não sobe (sem rede) fica na fila até a conexão voltar.
  const enviarFotos = useCallback(
    async (lista: FotoNaFila[]) => {
      if (enviandoFotos.current || !lista.length) return;
      enviandoFotos.current = true;
      for (const foto of lista) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) break;
        const f = new FormData();
        f.set("pedidoId", pedidoId);
        f.set("item", foto.chave);
        f.set("foto", foto.arquivo);
        let ok = false;
        try {
          const r = await enviarFotoAvaliacao(f);
          ok = r.ok;
          if (!r.ok) setErro(r.erro);
        } catch {
          setErro("Sem conexão: a foto ficou guardada até a rede voltar.");
        }
        if (!ok) break;
        setFotos((atual) => atual.filter((x) => x.id !== foto.id));
        setFotosEnviadas((n) => ({ ...n, [foto.chave]: (n[foto.chave] ?? 0) + 1 }));
      }
      enviandoFotos.current = false;
    },
    [pedidoId],
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

  useEffect(() => {
    const aoVoltar = () => void enviarFotos(fotos);
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
  }, [enviarFotos, fotos]);

  function responder(chave: string, valor: ValorItem, observacao: string | null) {
    setRespostas((r) => ({ ...r, [chave]: { valor, observacao } }));
    const nova = [...lerFila(chaveFila).filter((p) => p.chave !== chave), { chave, valor, observacao }];
    gravarFila(chaveFila, nova);
    setFila(nova);
    void enviar([{ chave, valor, observacao }]);
  }

  function anexarFoto(chave: string, arquivo: File | undefined) {
    if (!arquivo) return;
    const nova = { id: `${chave}-${Date.now()}`, chave, arquivo };
    setFotos((atual) => {
      const lista = [...atual, nova];
      void enviarFotos(lista);
      return lista;
    });
  }

  const faltam = useMemo(() => ITENS.filter((i) => !respostas[i.chave]).length, [respostas]);
  const passos = useMemo(() => passosDoChecklist(respostas), [respostas]);
  const faltaFotos = textoFaltaFotos(fotos.length);

  return (
    <div data-testid="checklist-avaliador">
      <p className="rounded-lg bg-sage-100 px-3 py-2 text-sm font-semibold text-ink" data-testid="aviso-sem-pessoas">
        {AVISO_SEM_PESSOAS}
      </p>
      <p className="mt-3 text-sm text-ink" data-testid="checklist-faltam" data-faltam={faltam}>
        {faltam === 0 ? "Checklist completo." : `Faltam ${faltam} de ${ITENS.length} itens.`} O progresso fica salvo a cada resposta.
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
      {faltaFotos && (
        <p className="mt-1 text-sm text-amber-700" role="status" data-testid="checklist-fotos-faltam" data-pendentes={fotos.length}>
          {faltaFotos}: elas sobem quando a conexão voltar.{" "}
          <button type="button" className="underline" onClick={() => void enviarFotos(fotos)}>
            Enviar agora
          </button>
        </p>
      )}
      {erro && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}

      {/* Os 9 passos: atalho no topo (rola até o passo) com o que já foi respondido. */}
      <nav aria-label="Passos da avaliação" className="-mx-1 mt-4 overflow-x-auto pb-1">
        <ol className="flex gap-2 px-1 lg:flex-wrap" data-testid="checklist-passos">
          {passos.map((p) => (
            <li key={p.grupo} className="shrink-0">
              <a
                href={`#passo-${p.grupo}`}
                className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-semibold ${p.completo ? "border-forest text-forest" : "border-line text-ink"}`}
                data-testid={`passo-atalho-${p.grupo}`}
                data-completo={p.completo ? "1" : "0"}
              >
                {p.completo && <CheckCircle2 className="h-4 w-4" aria-hidden />}
                {p.passo}. {p.rotulo} · {p.respondidos}/{p.total}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {GRUPOS_AVALIACAO.map((g) => {
        const passo = passos.find((p) => p.grupo === g.id)!;
        return (
          <fieldset key={g.id} id={`passo-${g.id}`} className="mt-4 scroll-mt-24 rounded-xl border border-line p-3 sm:p-4" data-testid="checklist-grupo" data-grupo={g.id}>
            <legend className="px-1 text-base font-semibold text-ink" data-testid="checklist-passo">
              {rotuloPasso(passo)}
            </legend>
            <p className="text-xs text-muted">
              {passo.respondidos} de {passo.total} respondidos
            </p>
            <ul className="mt-3 grid gap-4">
              {ITENS.filter((i) => i.grupo === g.id).map((i) => {
                const atual = respostas[i.chave];
                const valores = valoresDoItem(i);
                return (
                  <li key={i.chave} className="text-sm" data-testid="checklist-item" data-chave={i.chave} data-valor={atual?.valor ?? ""}>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {i.rotulo}
                      {i.testeEmUso && (
                        <span className="rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest" data-testid="teste-em-uso">
                          {TEXTO_TESTE_EM_USO}
                        </span>
                      )}
                      {i.grave && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Segurança</span>}
                    </p>
                    <p className="mt-1 text-xs text-muted">{i.criterio}</p>
                    <div role="group" aria-label={i.rotulo} className={`mt-2 grid gap-2 ${valores.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                      {valores.map((v) => {
                        const marcado = atual?.valor === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            aria-pressed={marcado}
                            data-testid={`item-${i.chave}-${v}`}
                            onClick={() => responder(i.chave, v, atual?.observacao ?? null)}
                            className={`min-h-11 rounded-lg border px-2 text-xs font-semibold leading-tight transition-colors sm:text-sm ${marcado ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
                          >
                            {ROTULO_VALOR[v]}
                          </button>
                        );
                      })}
                    </div>
                    {atual && pedeFotoDoItem(atual.valor) && (
                      <div className="mt-2 grid gap-2">
                        <input
                          defaultValue={atual.observacao ?? ""}
                          placeholder="O que está não conforme (sem nomes nem dados pessoais)"
                          aria-label={`Observação: ${i.rotulo}`}
                          maxLength={300}
                          className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base"
                          onBlur={(e) => e.target.value !== (atual.observacao ?? "") && responder(i.chave, atual.valor, e.target.value || null)}
                        />
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-lg border border-line px-3 text-sm font-semibold text-ink" data-testid={`foto-item-${i.chave}`}>
                          <Camera className="h-4 w-4" aria-hidden />
                          {fotosEnviadas[i.chave] ? `Foto enviada (${fotosEnviadas[i.chave]})` : "Foto do item"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="sr-only"
                            aria-label={`Foto do item: ${i.rotulo}`}
                            onChange={(e) => {
                              anexarFoto(i.chave, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {extras[g.id] && <div className="mt-4 border-t border-line pt-4">{extras[g.id]}</div>}
          </fieldset>
        );
      })}
    </div>
  );
}
