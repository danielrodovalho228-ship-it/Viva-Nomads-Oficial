"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DESTINO_VOLTAR_PAINEL, painelMostraVoltar, ROTULO_VOLTAR_PAINEL } from "@/lib/navegacao/voltar-painel";
import { veioDeDentroDoSite } from "@/lib/navegacao/voltar";

/**
 * E720 — o "← Voltar" padrão das telas internas do painel (celular e computador, mesma posição: topo do conteúdo).
 * Volta para onde a pessoa estava; aberta direto, para o início do painel. Mesmo visual do VoltarLista (E176).
 */
export function VoltarPainel() {
  const pathname = usePathname();
  const router = useRouter();
  if (!painelMostraVoltar(pathname)) return null;
  return (
    <Link
      href={DESTINO_VOLTAR_PAINEL}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (veioDeDentroDoSite(document.referrer, window.location.origin, window.history.length)) {
          e.preventDefault();
          router.back();
        }
      }}
      className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:underline"
      data-testid="voltar-painel"
    >
      <span aria-hidden>←</span> {ROTULO_VOLTAR_PAINEL}
    </Link>
  );
}
