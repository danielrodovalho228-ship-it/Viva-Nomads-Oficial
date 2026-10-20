"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Folha acessível (Fase 1b; padrão visual do Prompt 40): no celular sobe de
 * baixo para cima; no computador fica centralizada ou, com `lateral`, vira um
 * painel na lateral direita (folha de filtros da busca). Foco preso dentro,
 * Esc fecha, `aria-modal`, fundo clicável fecha, e respeita
 * `prefers-reduced-motion` (anima só quando permitido). Sem sombra: o fundo
 * escurecido já separa a folha da página.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  lateral = false,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** No computador (≥ 1024 px), painel lateral à direita em vez de caixa centralizada. */
  lateral?: boolean;
  testId?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // A função mais recente sem reexecutar o efeito (senão o foco voltava ao painel a cada render).
  const fechar = useRef(onClose);
  useEffect(() => {
    fechar.current = onClose;
  }, [onClose]);

  // Esc fecha + trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco inicial no painel.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Foco preso: Tab circula dentro do painel.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const foco = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    if (!foco || foco.length === 0) return;
    const primeiro = foco[0];
    const ultimo = foco[foco.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-end justify-center",
        lateral ? "sm:items-center lg:items-stretch lg:justify-end" : "sm:items-center"
      )}
      data-folha=""
    >
      <div className="bs-backdrop absolute inset-0 bg-black/50" onClick={() => fechar.current()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid={testId}
        className={cn(
          "bs-panel relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-xl bg-white outline-none sm:rounded-xl",
          lateral && "lg:h-full lg:max-h-none lg:w-[28rem] lg:max-w-none lg:rounded-none"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between border-b border-divisor px-4 py-3">
          <h2 className="font-title text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={() => fechar.current()}
            aria-label="Fechar"
            className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <div className="border-t border-divisor px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
