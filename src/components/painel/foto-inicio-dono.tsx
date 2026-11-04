"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * E501: a foto do bloco principal do início do dono, com plano B.
 * - O servidor já só manda URL de imagem cujo arquivo existe (E308/E405). Se mesmo assim o navegador não consegue
 *   mostrá-la (arquivo ilegível, URL que expirou), ela NÃO fica como caixa cinza vazia:
 *   no "Continue seu anúncio" vira o espaço desenhado; nas outras variações some e a grade volta a uma coluna.
 * - O espaço desenhado (rascunho sem foto, E308) tem moldura tracejada e ícone de câmera: lugar a preencher, não imagem
 *   quebrada. O texto é o aprovado. Nenhuma foto é inventada.
 */
export function FotoDoInicio({ foto, rascunho }: { foto: string | null; rascunho: boolean }) {
  const [falhou, setFalhou] = useState(false);
  if (foto && !falhou)
    return (
      // E308 (devolução 01/11): no "Continue seu anúncio", a FOTO REAL do rascunho (a primeira, por sort_order) em
      // encaixe de capa (object-cover), na moldura 16:10. Nas demais variações, a capa do anúncio inteira (contain).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={(img) => {
          // a imagem pode ter falhado antes da hidratação (o onError não chega a rodar)
          if (img && img.complete && img.naturalWidth === 0) setFalhou(true);
        }}
        src={foto}
        alt=""
        onError={() => setFalhou(true)}
        className={cn("aspect-[16/10] w-full rounded-lg bg-surface-2", rascunho ? "object-cover" : "object-contain")}
        data-testid="inicio-dono-foto"
      />
    );
  if (!rascunho) return <span hidden data-foto-falhou="" />;
  return (
    <div
      className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-forest/30 bg-sage-100 px-4 text-center text-sm font-semibold text-forest"
      data-testid="inicio-dono-foto-vazia"
    >
      <Camera className="h-8 w-8" aria-hidden />
      A foto principal aparece aqui
    </div>
  );
}
