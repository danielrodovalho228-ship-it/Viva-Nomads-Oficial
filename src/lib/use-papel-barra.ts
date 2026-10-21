"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { ehParceiroAprovado } from "@/lib/parceiros/painel-actions";

/**
 * Papel da barra inferior (Prompt 41, item 2), do lado do navegador. O modo morador/proprietário continua o de
 * sempre (activeMode); "usar como parceiro" é só uma PREFERÊNCIA de navegação deste aparelho (não muda dado nem
 * permissão) e só vale com a parceria aprovada.
 */
export const CHAVE_PAPEL_PARCEIRO = "vn-papel-barra";
const EVENTO = "vn-papel-barra";

export function lerPreferenciaParceiro(): boolean {
  try {
    return localStorage.getItem(CHAVE_PAPEL_PARCEIRO) === "parceiro";
  } catch {
    return false;
  }
}

/** Liga/desliga "usar a conta como parceiro" neste aparelho (a troca fica no Perfil). */
export function gravarPreferenciaParceiro(ligado: boolean) {
  try {
    if (ligado) localStorage.setItem(CHAVE_PAPEL_PARCEIRO, "parceiro");
    else localStorage.removeItem(CHAVE_PAPEL_PARCEIRO);
  } catch {
    /* sem armazenamento: a barra segue o modo */
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function usePreferenciaParceiro(): boolean {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    const ler = () => setLigado(lerPreferenciaParceiro());
    ler();
    window.addEventListener(EVENTO, ler);
    window.addEventListener("storage", ler);
    return () => {
      window.removeEventListener(EVENTO, ler);
      window.removeEventListener("storage", ler);
    };
  }, []);
  return ligado;
}

/** A conta tem a parceria aprovada? (só com sessão; sem sessão, false sem chamar o servidor). */
export function useParceiroAprovado(): boolean {
  const userId = useAuthStore((s) => s.user?.id);
  const [aprovado, setAprovado] = useState(false);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    ehParceiroAprovado()
      .then((t) => vivo && setAprovado(t))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [userId]);
  return !!userId && aprovado;
}
