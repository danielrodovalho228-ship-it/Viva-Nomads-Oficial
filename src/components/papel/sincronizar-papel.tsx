"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";
import { useParceiroAprovado } from "@/lib/use-papel-barra";
import { usarPapel } from "@/lib/data/papel-actions";
import { gravacaoPorArea, papelDaRota, papelDoModo, trocaPelaArea } from "@/lib/papel/papel-ativo";
import { EVENTO_PAPEL } from "./use-troca-papel";

/**
 * PAPEL-B — navegação coerente: abrir uma página de OUTRA área (link de e-mail, favorito, push) troca o papel ativo
 * para o daquela área e GRAVA, para o selo e o menu sempre baterem com a página. Páginas comuns (Visão geral,
 * mensagens, conta, ajuda) não mudam o papel. Admin é Equipe: nada a sincronizar. Não desenha nada.
 * E548 (QA 04/11) e E653 (QA 06/11): o papel nunca muda sozinho. Abrir QUALQUER área (morador, proprietário ou parceiro)
 * NÃO troca nem grava o papel do painel: a página se desenha pela URL (modoDaRota/papelDaRota, E497) e, ao sair dela, o
 * painel volta ao papel escolhido. Só o 1º acesso (E283, o servidor grava só o modo) sincroniza.
 */
export function SincronizarPapel() {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.user?.role === "admin");
  const userId = useAuthStore((s) => s.user?.id);
  const parceiroAtivo = useAuthStore((s) => s.parceiroAtivo);
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
    // E653: abrir uma página de área NUNCA troca nem grava o papel — nem a do parceiro (antes gravava papel_ativo =
    // "parceiro": o papel guardado mudava sem clique e o topo alternava entre "Áreas do proprietário" e "Áreas do
    // parceiro"). A página se desenha pela URL; só o 1º acesso grava (o servidor grava o modo, E283).
    if (gravacaoPorArea(alvo, true) === "nada") return;
    // …e grava só o que esta aba ainda não gravou.
    if (gravado.current === alvo) return;
    gravado.current = alvo;
    // E283: "area" — numa conta no 1º acesso, só o modo é gravado (o papel inicial fica para a intenção decidir).
    usarPapel(alvo, "area")
      .then(() => window.dispatchEvent(new Event(EVENTO_PAPEL)))
      .catch(() => {
        gravado.current = null;
      });
  }, [pathname, userId, admin, parceiroAtivo, aprovado, mode]);

  return null;
}
