"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmarConforto, confortoDoImovel } from "@/lib/data/conforto-actions";

export type SalvamentoConforto = { estado: "salvando" | "salvo" | "erro"; erro?: string } | null;

const FALHA_CARGA = "Não foi possível carregar os itens já confirmados. Confira a internet.";

/**
 * 59-C1 — o checklist do padrão mínimo salva sozinho, item a item, com estado próprio ("Salvando…" / "Confirmação
 * salva" / erro com a causa). Regras:
 * - com id: cada mudança do dono grava na hora (as gravações saem em fila; vale a última);
 * - sem id ainda (anúncio novo): grava assim que o primeiro autosave criar o rascunho;
 * - só depois de carregar o que já estava salvo (até lá o checklist fica travado): uma lista montada sobre um estado
 *   vazio nunca desmarca o que o dono já tinha confirmado.
 */
export function useConfortoSalvo(propertyId: string | null, inicial?: readonly string[]) {
  const [marcados, setMarcados] = useState<string[]>(() => [...(inicial ?? [])]);
  const [carregadoPara, setCarregadoPara] = useState<string | null>(inicial && propertyId ? propertyId : null);
  const [falhaCarga, setFalhaCarga] = useState(false);
  const [tentativaCarga, setTentativaCarga] = useState(0);
  const [salvamento, setSalvamento] = useState<SalvamentoConforto>(null);
  const [mexido, setMexido] = useState(false);
  const idRef = useRef(propertyId);
  const mexidoRef = useRef(false);
  const marcadosRef = useRef<string[]>(marcados);
  const emVoo = useRef(false);
  const proxima = useRef<string[] | null>(null);

  useEffect(() => {
    idRef.current = propertyId;
  }, [propertyId]);

  const salvar = useCallback(async (lista: string[]) => {
    const id = idRef.current;
    if (!id) return; // anúncio novo: grava quando o rascunho ganhar id
    if (emVoo.current) {
      proxima.current = lista;
      return;
    }
    emVoo.current = true;
    let atual: string[] | null = lista;
    while (atual) {
      setSalvamento({ estado: "salvando" });
      let r: Awaited<ReturnType<typeof confirmarConforto>>;
      try {
        r = await confirmarConforto(id, atual);
      } catch {
        r = { ok: false, erro: "Sem conexão — a confirmação não foi salva." };
      }
      atual = proxima.current;
      proxima.current = null;
      if (!atual) setSalvamento(r.ok ? { estado: "salvo" } : { estado: "erro", erro: r.erro });
    }
    emVoo.current = false;
  }, []);

  // O que já estava salvo. Se o dono marcou antes de o rascunho existir, a marcação dele vale e é gravada agora.
  useEffect(() => {
    if (!propertyId || carregadoPara === propertyId) return;
    let vivo = true;
    confortoDoImovel(propertyId)
      .then((e) => {
        if (!vivo) return;
        setFalhaCarga(false);
        if (mexidoRef.current) {
          void salvar(marcadosRef.current);
        } else {
          const salvos = e ? e.itens.filter((i) => i.confirmado).map((i) => i.chave) : [];
          marcadosRef.current = salvos;
          setMarcados(salvos);
        }
        setCarregadoPara(propertyId);
      })
      .catch(() => {
        if (vivo) setFalhaCarga(true);
      });
    return () => {
      vivo = false;
    };
  }, [propertyId, carregadoPara, tentativaCarga, salvar]);

  const carregado = !propertyId || carregadoPara === propertyId;

  const alterar = useCallback(
    (lista: string[]) => {
      mexidoRef.current = true;
      marcadosRef.current = lista;
      setMexido(true);
      setMarcados(lista);
      void salvar(lista);
    },
    [salvar],
  );

  const tentarDeNovo = useCallback(() => {
    if (falhaCarga) setTentativaCarga((n) => n + 1);
    else void salvar(marcadosRef.current);
  }, [falhaCarga, salvar]);

  return {
    marcados,
    alterar,
    carregado,
    /** O dono mexeu no checklist nesta sessão, depois de carregar o salvo: só então a lista vai no "Salvar"/"Publicar". */
    mexido: mexido && carregado,
    salvamento: falhaCarga ? ({ estado: "erro", erro: FALHA_CARGA } as const) : salvamento,
    tentarDeNovo,
  };
}
