"use client";

import { useEffect, useState } from "react";

/** Evento que o formulário de assinatura dispara com o cartão já atualizado (a resposta da ação traz o texto novo). */
export const EVENTO_AVISO_ASSINATURA = "vn:contrato-aviso";

/**
 * Cartão "quem assinou". Mostra o texto do servidor; quando a pessoa acaba de assinar, mostra na hora o texto que a
 * própria ação devolveu, sem depender do recarregamento da página. Se o servidor mandar um texto novo, ele vale.
 */
export function AvisoAssinatura({ contratoId, aviso }: { contratoId: string; aviso: string }) {
  const [doServidor, setDoServidor] = useState(aviso);
  const [local, setLocal] = useState<string | null>(null);
  if (aviso !== doServidor) {
    setDoServidor(aviso);
    setLocal(null);
  }
  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<{ contratoId?: string; aviso?: string }>).detail;
      if (d?.contratoId === contratoId && typeof d.aviso === "string") setLocal(d.aviso);
    };
    window.addEventListener(EVENTO_AVISO_ASSINATURA, ouvir);
    return () => window.removeEventListener(EVENTO_AVISO_ASSINATURA, ouvir);
  }, [contratoId]);
  return (
    <p className="mt-4 whitespace-pre-line text-sm text-muted [overflow-wrap:anywhere]" data-testid="contrato-aviso-assinatura">
      {local ?? aviso}
    </p>
  );
}
