"use client";

import { Children, cloneElement, isValidElement } from "react";
import { AlertTriangle, Minus, Plus, Sparkles } from "lucide-react";
import { isoParaBr } from "@/lib/data-digitada";
import { CampoDataTexto } from "@/components/ui/campo-data";
import { useToque } from "@/components/ui/use-toque";
import { MARCA_SUGERIDO } from "@/lib/anuncio/sugestoes-cadastro";
import { cn } from "@/lib/utils";
import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";

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

/**
 * E134 (mockup cadastro-imovel-04): uma linha do cartão de números — rótulo e dica à esquerda, contador "− N +" à
 * direita. Todas as linhas têm a mesma altura e o contador fica sempre na mesma coluna: a dica nunca desloca a caixa,
 * e não há grade com buraco. O campo continua digitável (o "−"/"+" só ajudam).
 */
export function LinhaNumero({
  label,
  dica,
  valor,
  onChange,
  min = 0,
  passo = 1,
  sufixo,
  sugerido = false,
  daMatricula = false,
  testid,
  erro,
  placeholder,
}: {
  label: string;
  dica: string;
  valor: string;
  onChange: (v: string) => void;
  min?: number;
  passo?: number;
  sufixo?: string;
  sugerido?: boolean;
  daMatricula?: boolean;
  testid?: string;
  erro?: string;
  placeholder?: string;
}) {
  const n = Number(valor);
  const atual = valor === "" || !Number.isFinite(n) ? null : n;
  const mudar = (d: number) => onChange(String(Math.max(min, (atual ?? min) + d)));
  return (
    <div className="py-3" data-testid={testid ? `linha-${testid}` : undefined}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center text-sm font-semibold text-ink">
            <span>{label}</span>
            <MarcaSugerido ativo={sugerido} />
            {daMatricula && (
              <span className="ml-2 inline-flex items-center rounded-full bg-sage-50 px-2 py-1 text-[11px] font-semibold text-forest" data-testid="veio-da-matricula">
                veio da matrícula
              </span>
            )}
          </p>
          <p className="text-xs text-muted">{dica}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-white p-1" data-testid="contador">
          <button
            type="button"
            onClick={() => mudar(-passo)}
            disabled={atual !== null && atual <= min}
            aria-label={`Diminuir ${label}`}
            className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-surface-2 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          {/* Miolo de largura fixa: o sufixo (m²) cabe dentro, e todos os contadores têm a mesma largura (E134). */}
          <span className="flex w-20 items-center justify-center">
            <input
              type="number"
              inputMode="numeric"
              min={min}
              value={valor}
              // E241 (mockup cadastro-imovel-04: o contador sempre mostra um número): vazio, o miolo mostra o mínimo
              // ("0") em cinza — o campo continua "não preenchido" para a validação, só não fica em branco.
              placeholder={placeholder ?? String(min)}
              onChange={(e) => onChange(e.target.value)}
              aria-label={label}
              className="h-9 w-full min-w-0 bg-transparent text-center text-base font-semibold tabular-nums text-ink outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              data-testid={testid}
            />
            {sufixo && <span className="shrink-0 text-xs text-muted">{sufixo}</span>}
          </span>
          <button
            type="button"
            onClick={() => mudar(passo)}
            aria-label={`Aumentar ${label}`}
            className="grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-surface-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <Erro msg={erro} />
    </div>
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
  // E193: sim/não é o cartão grande da Qualificação (✓ redondo), não mais o cartão com caixinha quadrada.
  return (
    <CartaoEscolha
      papel="pressed"
      on={checked}
      onClick={onChange}
      testid={testid}
      rotulo={
        <>
          {label}
          <MarcaSugerido ativo={sugerido} />
        </>
      }
      dica={hint}
    />
  );
}

/**
 * Campo de data do cadastro. Valor em AAAA-MM-DD.
 *  • Celular (toque): o `input type="date"` nativo, SEM máscara (Q8/Q9) — no iPhone abre só o calendário. Ocupa 100%
 *    da largura e não sai do cartão no iOS (`appearance: none`, `min-width: 0`).
 *  • Computador (prompt 22): digitar dd/mm/aaaa com máscara, COLAR em vários formatos (01/11/2026, 2026-11-01…) e o
 *    calendário num botão ao lado (o campo nativo do computador é segmentado e não aceitava digitar nem colar). E136:
 *    o calendário é o do site, em pt-BR (`CalendarioBR`); o pop-up do navegador saía no idioma do navegador.
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

  if (toque) {
    // E136: o campo nativo escreve a data no idioma do APARELHO ("Oct 25, 2026" num iPhone em inglês). O texto nativo
    // fica transparente e a data aparece por cima SEMPRE em pt-BR (25/10/2026); o toque continua abrindo o calendário.
    return (
      <span className="relative block min-w-0">
        <input
          type="date"
          lang="pt-BR"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          data-testid={testid}
          data-vazio={value ? undefined : "1"}
          className="input box-border block h-11 w-full min-w-0 max-w-full appearance-none text-transparent [&::-webkit-datetime-edit]:text-transparent"
        />
        <span className={cn("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm tabular-nums", value ? "text-ink" : "text-muted")} aria-hidden data-testid={testid ? `${testid}-texto` : undefined}>
          {value ? isoParaBr(value) : "dd/mm/aaaa"}
        </span>
      </span>
    );
  }

  const antesDoMinimo = !!value && !!min && value < min;
  return (
    <span className="block min-w-0">
      <CampoDataTexto
        value={value}
        aoMudar={onChange}
        min={min}
        ariaLabel={ariaLabel}
        testid={testid}
        aria-invalid={antesDoMinimo || undefined}
        className="input h-11"
      />
      {antesDoMinimo && (
        <span className="mt-1 block text-xs text-red-700" role="alert">
          A data não pode ser antes de {isoParaBr(min!)}.
        </span>
      )}
    </span>
  );
}
