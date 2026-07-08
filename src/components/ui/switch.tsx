"use client";

import { cn } from "@/lib/utils";

/**
 * Switch ÚNICO e compartilhado (trilho + botão deslizante). Substitui os toggles
 * duplicados que renderavam como "blocos" sem estado visível — a bolinha ficava
 * fora do trilho por um bug de posicionamento (left fantasma + translate).
 *
 * Robustez: a bolinha é um flex-item centralizado verticalmente e desliza por
 * `transform` INLINE (não depende de classes translate-x-* geradas pelo Tailwind),
 * com tamanho fixo. Estados: on/off/focus/disabled.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Rótulo acessível (aria-label) quando não há <label> visível ao lado. */
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-forest/40 focus-visible:ring-offset-2",
        checked ? "bg-forest" : "bg-sage-200",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform"
        // 44px de trilho, bolinha de 20px, folga de 2px: off=2px, on=22px (mantém DENTRO do trilho).
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}
