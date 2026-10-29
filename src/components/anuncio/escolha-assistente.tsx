"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  E193 (auditoria de 28/10): UM jeito de escolher no assistente de cadastro inteiro.
   - Várias escolhas → Pilula (o chip arredondado das telas aprovadas).
   - Uma escolha ou sim/não → CartaoEscolha (o mesmo cartão grande tocável da Qualificação: borda dupla, ✓ redondo).
  Nada de caixa quadrada nem lista suspensa dentro do assistente. A semântica continua a de antes (checkbox, radio ou
  switch com aria-checked, ou botão com aria-pressed onde já era assim), para leitor de tela e para os testes.
*/

type Papel = "checkbox" | "radio" | "switch" | "pressed";

/** role + aria-checked, ou só aria-pressed (botão alternável). */
const semantica = (papel: Papel, on: boolean) => (papel === "pressed" ? { "aria-pressed": on } : { role: papel, "aria-checked": on });

export function Pilula({
  on,
  onClick,
  children,
  papel = "checkbox",
  disabled,
  testid,
  className,
  ...resto
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  papel?: Papel;
  disabled?: boolean;
  testid?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "role" | "className" | "disabled">) {
  return (
    <button
      type="button"
      {...semantica(papel, on)}
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      data-pilula-assistente
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:border-sage",
        className
      )}
      {...resto}
    >
      {on && <Check className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

export function CartaoEscolha({
  on,
  onClick,
  rotulo,
  dica,
  icone: Icone,
  papel = "radio",
  disabled,
  testid,
  className,
  ...resto
}: {
  on: boolean;
  onClick: () => void;
  rotulo: React.ReactNode;
  dica?: React.ReactNode;
  icone?: React.ComponentType<{ className?: string }>;
  papel?: Papel;
  disabled?: boolean;
  testid?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "role" | "className" | "disabled">) {
  return (
    <button
      type="button"
      {...semantica(papel, on)}
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      data-cartao-assistente
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 bg-white p-4 text-left text-sm text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-forest bg-sage-100" : "border-line hover:border-sage",
        className
      )}
      {...resto}
    >
      {Icone && <Icone className={cn("h-6 w-6 shrink-0", on ? "text-forest" : "text-muted")} />}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{rotulo}</span>
        {dica && <span className="mt-1 block text-xs font-normal text-muted">{dica}</span>}
      </span>
      {on && <Check className="h-5 w-5 shrink-0 rounded-full bg-forest p-1 text-white" aria-hidden />}
    </button>
  );
}
