"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  E193 (auditoria de 28/10): UM jeito de escolher no assistente de cadastro inteiro.
   - Toda escolha (uma, várias, sim/não) → CartaoEscolha: o mesmo cartão grande tocável da Qualificação (borda dupla, ✓ redondo).
     Uma escolha = papel "radio" (EscolhaUnica); várias = papel "checkbox" ou "pressed".
   - Pilula (chip arredondado) NÃO é mais usada no assistente: ela fica só para fora dele (ex.: proximidades manuais).
  Nada de caixa quadrada, lista suspensa nem pílula dentro do assistente (E193, reteste de 29/10). A semântica continua a de antes (checkbox, radio ou
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
  indicador = "check",
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
  /** "check" (✓ redondo, o padrão) ou "toggle" (trilho do interruptor à direita — o bloco opcional do E56, como nos mockups). */
  indicador?: "check" | "toggle";
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
      {indicador === "toggle" ? (
        <span
          aria-hidden
          data-testid={testid ? `${testid}-trilho` : undefined}
          className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors", on ? "bg-forest" : "bg-sage-200")}
        >
          <span className={cn("inline-block h-5 w-5 rounded-full bg-white transition-transform", on ? "translate-x-6" : "translate-x-1")} />
        </span>
      ) : (
        on && <Check className="h-5 w-5 shrink-0 rounded-full bg-forest p-1 text-white" aria-hidden />
      )}
    </button>
  );
}

/** Grupo de escolha única em cartões grandes (substitui rádio redondo e lista suspensa). `testid` fica no grupo; cada cartão é `${testid}-${valor}` ("nd" = vazio). */
export function EscolhaUnica<T extends string | number | null>({
  testid,
  legenda,
  opcoes,
  valor,
  onChange,
  colunas = 2,
}: {
  testid: string;
  legenda?: React.ReactNode;
  opcoes: readonly { valor: T; rotulo: React.ReactNode; dica?: React.ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
  colunas?: 1 | 2;
}) {
  return (
    <fieldset data-testid={testid}>
      {legenda && <legend className="text-sm font-semibold text-ink">{legenda}</legend>}
      <div
        role="radiogroup"
        aria-label={typeof legenda === "string" ? legenda : undefined}
        className={cn("mt-2 grid gap-2", colunas === 2 && "sm:grid-cols-2")}
      >
        {opcoes.map((o) => (
          <CartaoEscolha
            key={String(o.valor ?? "nd")}
            on={valor === o.valor}
            onClick={() => onChange(o.valor)}
            rotulo={o.rotulo}
            dica={o.dica}
            testid={`${testid}-${o.valor === null || o.valor === "" ? "nd" : o.valor}`}
          />
        ))}
      </div>
    </fieldset>
  );
}
