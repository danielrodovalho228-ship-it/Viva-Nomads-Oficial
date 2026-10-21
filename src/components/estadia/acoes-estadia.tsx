"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, DoorOpen, FileText, MessageSquare, Sparkles, Wrench } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { buttonClasses } from "@/components/ui/button";
import type { AcaoEstadia, ChaveAcaoEstadia } from "@/lib/estadia/acoes-estadia";

const ICONE: Record<ChaveAcaoEstadia, React.ComponentType<{ className?: string }>> = {
  falar: MessageSquare,
  contrato: FileText,
  instrucoes: DoorOpen,
  manutencao: Wrench,
};

/**
 * Botão flutuante "cogumelo" (Prompt 41, item 4): só no detalhe de uma estadia, para o morador e o proprietário dela.
 * Abre a folha "Ações desta estadia" (lista com ícone, só ações que já existem — src/lib/estadia/acoes-estadia.ts).
 * Flutua: sombra única --shadow-flutuante. Fica no canto onde o "Fale com a Viva" mora, e o "Fale com a Viva" sobe
 * acima dele (globals.css, .vn-cogumelo); o espaço no fim da tela impede que ele cubra a última ação da página.
 */
export function AcoesEstadia({ acoes }: { acoes: AcaoEstadia[] }) {
  const [aberto, setAberto] = useState(false);
  if (acoes.length === 0) return null;
  return (
    <>
      <div className="h-24 print:hidden" aria-hidden data-testid="cogumelo-folga" />
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label="Ações desta estadia"
        data-testid="cogumelo"
        className={buttonClasses({ variant: "flutuante", className: "vn-cogumelo fixed z-40 print:hidden" })}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        Ações
      </button>
      <BottomSheet open={aberto} onClose={() => setAberto(false)} title="Ações desta estadia" testId="folha-acoes-estadia">
        <ul className="-mx-4 divide-y divide-divisor" data-testid="acoes-estadia-lista">
          {acoes.map((a) => {
            const Icone = ICONE[a.chave];
            const conteudo = (
              <>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2">
                  <Icone className="h-5 w-5 text-forest" />
                </span>
                <span className="min-w-0 flex-1 text-base text-ink">{a.rotulo}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </>
            );
            const cls = "flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2";
            return (
              <li key={a.chave} data-acao={a.chave}>
                {a.href.startsWith("#") ? (
                  <a href={a.href} className={cls} onClick={() => setAberto(false)}>
                    {conteudo}
                  </a>
                ) : (
                  <Link href={a.href} className={cls} onClick={() => setAberto(false)}>
                    {conteudo}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
