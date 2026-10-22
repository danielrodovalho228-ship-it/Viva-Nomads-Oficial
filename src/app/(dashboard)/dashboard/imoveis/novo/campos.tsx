"use client";

import { Children, cloneElement, isValidElement, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CalendarDays, Check, Sparkles } from "lucide-react";
import { brParaIso, interpretarDataColada, isoParaBr, mascararData } from "@/lib/data-digitada";
import { MARCA_SUGERIDO } from "@/lib/anuncio/sugestoes-cadastro";
import { cn } from "@/lib/utils";

/** Mensagem de erro de validação sob um campo (item QA — validação por etapa). */
export function Erro({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600" role="alert">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {msg}
    </p>
  );
}

/** Marca dos campos preenchidos pela IA ou por estimativa: "Sugerido · confira" (prompt 10). */
export function MarcaSugerido({ ativo, className }: { ativo: boolean; className?: string }) {
  if (!ativo) return null;
  return (
    <span
      className={cn("ml-2 inline-flex items-center gap-1 rounded-full bg-champagne/30 px-2 py-1 text-[11px] font-semibold text-forest", className)}
      data-testid="marca-sugerido"
    >
      <Sparkles className="h-3 w-3" aria-hidden /> {MARCA_SUGERIDO}
    </span>
  );
}

export function Labeled({
  label,
  children,
  sugerido = false,
  ajuda,
  daMatricula = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Mostra "Sugerido · confira" ao lado do rótulo. */
  sugerido?: boolean;
  /** Texto curto abaixo do rótulo (ex.: "(opcional)") — mantém o rótulo numa linha só (Q9). */
  ajuda?: string;
  /** Prompt 19: o valor veio da matrícula (editável) — etiqueta "veio da matrícula". */
  daMatricula?: boolean;
}) {
  // Além do <label> em volta, o campo ganha um nome acessível explícito
  // (leitores de tela/validadores que não seguem o rótulo implícito).
  const [primeiro, ...resto] = Children.toArray(children);
  const campo =
    isValidElement<Record<string, unknown>>(primeiro) &&
    typeof primeiro.type === "string" &&
    ["input", "select", "textarea"].includes(primeiro.type) &&
    !primeiro.props["aria-label"]
      ? cloneElement(primeiro, { "aria-label": label })
      : primeiro;
  return (
    <label className="block min-w-0">
      <span className="mb-2 flex flex-wrap items-center text-sm font-medium text-ink">
        <span className="whitespace-nowrap">{label}</span>
        <MarcaSugerido ativo={sugerido} />
        {daMatricula && (
          <span className="ml-2 inline-flex items-center rounded-full bg-sage-50 px-2 py-1 text-[11px] font-semibold text-forest" data-testid="veio-da-matricula">
            veio da matrícula
          </span>
        )}
      </span>
      {ajuda && <span className="-mt-1 mb-2 block text-xs text-muted">{ajuda}</span>}
      {campo}
      {resto}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  sugerido = false,
  testid,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  sugerido?: boolean;
  testid?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      data-testid={testid}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        checked ? "border-forest bg-sage-100" : "border-sage-200 hover:border-sage"
      )}
    >
      <span
        className={cn(
          "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-lg border",
          checked ? "border-forest bg-forest text-white" : "border-sage-200 bg-white"
        )}
      >
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-medium text-ink">
          {label}
          <MarcaSugerido ativo={sugerido} />
        </span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/** Tela de toque (celular/tablet)? Lido do navegador; no servidor, "não" (o campo do computador). */
function useToque(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

/**
 * Campo de data do cadastro. Valor em AAAA-MM-DD.
 *  • Celular (toque): o `input type="date"` nativo, SEM máscara (Q8/Q9) — no iPhone abre só o calendário. Ocupa 100%
 *    da largura e não sai do cartão no iOS (`appearance: none`, `min-width: 0`).
 *  • Computador (prompt 22): digitar dd/mm/aaaa com máscara, COLAR em vários formatos (01/11/2026, 2026-11-01…) e o
 *    calendário num botão ao lado (o campo nativo do computador é segmentado e não aceitava digitar nem colar).
 */
export function CampoDataUnico({
  value,
  onChange,
  ariaLabel,
  min,
  testid,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  min?: string;
  testid?: string;
}) {
  const toque = useToque();
  const calendario = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(isoParaBr(value));
  // Mudança de fora (rascunho, calendário): o texto acompanha — ajuste na renderização, sem efeito.
  const [anterior, setAnterior] = useState(value);
  if (anterior !== value) {
    setAnterior(value);
    if (brParaIso(texto) !== value) setTexto(isoParaBr(value));
  }

  if (toque) {
    // No iOS o campo de data vazio aparece em branco: um exemplo "dd/mm/aaaa" por cima, que some ao tocar.
    return (
      <span className="relative block min-w-0">
        <input
          type="date"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          data-testid={testid}
          data-vazio={value ? undefined : "1"}
          className="peer input box-border block h-11 w-full min-w-0 max-w-full appearance-none data-[vazio=1]:text-transparent focus:text-ink"
        />
        {!value && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted peer-focus:hidden" aria-hidden>
            dd/mm/aaaa
          </span>
        )}
      </span>
    );
  }

  const antesDoMinimo = !!value && !!min && value < min;
  return (
    <span className="block min-w-0">
      <span className="relative block min-w-0">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          value={texto}
          onChange={(e) => {
            const m = mascararData(e.target.value);
            setTexto(m);
            onChange(brParaIso(m) ?? "");
          }}
          onPaste={(e) => {
            const iso = interpretarDataColada(e.clipboardData.getData("text"));
            if (!iso) return; // formato desconhecido: deixa o navegador colar e a máscara limpar
            e.preventDefault();
            setTexto(isoParaBr(iso));
            onChange(iso);
          }}
          aria-label={ariaLabel}
          aria-invalid={antesDoMinimo || undefined}
          data-testid={testid}
          className="input box-border block h-11 w-full min-w-0 max-w-full pr-11"
        />
        <button
          type="button"
          onClick={() => {
            const c = calendario.current;
            if (!c) return;
            try {
              c.showPicker();
            } catch {
              c.focus();
            }
          }}
          aria-label={`Abrir calendário: ${ariaLabel}`}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-forest hover:bg-sage-50"
          data-testid={testid ? `${testid}-calendario` : undefined}
        >
          <CalendarDays className="h-5 w-5" aria-hidden />
        </button>
        {/* O calendário do navegador, sem aparecer: o botão acima o abre. */}
        <input
          ref={calendario}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
        />
      </span>
      {antesDoMinimo && (
        <span className="mt-1 block text-xs text-red-700" role="alert">
          A data não pode ser antes de {isoParaBr(min!)}.
        </span>
      )}
    </span>
  );
}
