"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Cabeçalho das telas de FLUXO no mobile (Fase 1b): botão Voltar + título + uma
 * ação opcional à direita. Fixo no topo, respeita a safe-area. A barra inferior
 * fica escondida nessas telas (ver isFlowRoute). Só aparece em < md; no desktop
 * o cabeçalho do painel continua.
 */
export function MobileHeader({
  title,
  onBack,
  backHref,
  action,
}: {
  title: string;
  /** Ação custom do voltar; sem ela, volta uma página no histórico. */
  onBack?: () => void;
  /** Se informado, o voltar navega para esta rota em vez do histórico. */
  backHref?: string;
  /** Elemento à direita (ex.: botão de salvar/limpar). */
  action?: React.ReactNode;
}) {
  const router = useRouter();

  function voltar() {
    if (onBack) return onBack();
    if (backHref) return router.push(backHref);
    router.back();
  }

  return (
    <header
      className="sticky z-40 flex h-14 items-center gap-2 border-b border-line bg-surface px-2 md:hidden print:hidden"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <button
        type="button"
        onClick={voltar}
        aria-label="Voltar"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink hover:bg-surface-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {/* <p>, não <h1>: o h1 é o da própria página (um só por página). */}
      <p className="min-w-0 flex-1 truncate font-title text-base font-bold text-ink">{title}</p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
