"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useParceiroAprovado } from "@/lib/use-papel-barra";
import { usarPapel } from "@/lib/data/papel-actions";
import { papelDaRota, papelDoModo, trocaPelaArea } from "@/lib/papel/papel-ativo";
import { EVENTO_PAPEL } from "./use-troca-papel";

/**
 * PAPEL-B — navegação coerente: abrir uma página de OUTRA área (link de e-mail, favorito, push) troca o papel ativo
 * para o daquela área e GRAVA, para o selo e o menu sempre baterem com a página. Páginas comuns (Visão geral,
 * mensagens, conta, ajuda) não mudam o papel. Admin é Equipe: nada a sincronizar. Não desenha nada.
 */
export function SincronizarPapel() {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.user?.role === "admin");
  const userId = useAuthStore((s) => s.user?.id);
  const parceiroAtivo = useAuthStore((s) => s.parceiroAtivo);
  const setPapel = useAuthStore((s) => s.setPapel);
  const { mode } = useViewMode();
  const aprovado = useParceiroAprovado();
  /** O papel que esta aba acabou de gravar pela área (evita regravar o mesmo valor enquanto o estado se acerta). */
  const gravado = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || admin) return;
    const escolhido = parceiroAtivo && aprovado ? "parceiro" : papelDoModo(mode === "owner" ? "owner" : "tenant");
    const alvo = trocaPelaArea(papelDaRota(pathname, aprovado), escolhido);
    if (!alvo) {
      // Página e papel já batem: esquece o último gravado (uma troca explícita depois pode precisar regravar).
      gravado.current = null;
      return;
    }
    // Sempre acerta o estado local (a leitura do perfil no login pode chegar depois e trazer o valor antigo)…
    setPapel(alvo);
    // …e grava só o que esta aba ainda não gravou.
    if (gravado.current === alvo) return;
    gravado.current = alvo;
    usarPapel(alvo)
      .then(() => window.dispatchEvent(new Event(EVENTO_PAPEL)))
      .catch(() => {
        gravado.current = null;
      });
  }, [pathname, userId, admin, parceiroAtivo, aprovado, mode, setPapel]);

  return null;
}
