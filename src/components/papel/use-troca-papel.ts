"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { estadoDosPapeis, usarPapel } from "@/lib/data/papel-actions";
import { painelDoPapel, type Papel } from "@/lib/papel/papel-ativo";

/** Duração da animação curta de troca (decisão do Daniel, outubro): o selo esmaece e volta com o papel novo. */
export const DURACAO_TROCA_MS = 250;
/** Evento que os dois pontos de troca (selo do topo e Conta) usam para se manter iguais. */
export const EVENTO_PAPEL = "vn-papel-ativo";

/**
 * PAPEL-B — a troca explícita de papel, a MESMA no selo do topo e na Conta: grava o papel ativo no perfil, aplica no
 * store (o menu e a barra trocam na hora) e leva ao painel daquele papel.
 */
export function useTrocaPapel() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const setPapel = useAuthStore((s) => s.setPapel);
  const [papeis, setPapeis] = useState<Papel[] | null>(null);
  const [trocando, setTrocando] = useState<Papel | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    const ler = () =>
      estadoDosPapeis()
        .then((e) => vivo && e && setPapeis(e.papeis))
        .catch(() => {});
    ler();
    window.addEventListener(EVENTO_PAPEL, ler);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_PAPEL, ler);
    };
  }, [userId]);

  const trocar = useCallback(
    async (papel: Papel) => {
      setErro(null);
      setTrocando(papel);
      const r = await usarPapel(papel).catch(() => ({ ok: false as const, erro: "Não foi possível trocar agora." }));
      if (!r.ok) {
        setTrocando(null);
        setErro(r.erro);
        return;
      }
      setPapel(papel);
      window.dispatchEvent(new Event(EVENTO_PAPEL));
      router.push(painelDoPapel(papel));
      window.setTimeout(() => setTrocando(null), DURACAO_TROCA_MS);
    },
    [router, setPapel],
  );

  return { papeis, trocando, erro, trocar };
}
