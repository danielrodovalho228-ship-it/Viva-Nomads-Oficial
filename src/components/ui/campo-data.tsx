"use client";

import { useCallback, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { CalendarioBR } from "@/components/ui/calendario-br";
import { useToque } from "@/components/ui/use-toque";
import { brParaIso, interpretarDataColada, isoParaBr, mascararData } from "@/lib/data-digitada";
import { cn } from "@/lib/utils";

/**
 * Campo de data do COMPUTADOR (E136): digitar dd/mm/aaaa com máscara, colar em vários formatos e, no botão ao lado, o
 * calendário do site em pt-BR (`CalendarioBR`). O campo nativo do computador é segmentado, sai em mm/dd/yyyy num
 * navegador em inglês e o pop-up dele vem no idioma do navegador ("November 2026", "Clear", "Today").
 * Valor em ISO (AAAA-MM-DD). Uma data ISO digitada de uma vez (colada ou preenchida) também vale.
 */
export function CampoDataTexto({
  value,
  aoMudar,
  min,
  ariaLabel,
  testid,
  className,
  rotuloCalendario,
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min"> & {
  value: string;
  aoMudar: (iso: string) => void;
  min?: string;
  ariaLabel?: string;
  testid?: string;
  /** O nome do campo no botão e no calendário ("Abrir calendário: Disponível a partir de"). */
  rotuloCalendario?: string;
}) {
  const caixa = useRef<HTMLSpanElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(isoParaBr(value));
  // Mudança de fora (rascunho, calendário): o texto acompanha — ajuste na renderização, sem efeito.
  const [anterior, setAnterior] = useState(value);
  if (anterior !== value) {
    setAnterior(value);
    if (brParaIso(texto) !== value) setTexto(isoParaBr(value));
  }
  const fechar = useCallback(() => setAberto(false), []);
  const nome = rotuloCalendario ?? ariaLabel;

  return (
    <span ref={caixa} className="relative block min-w-0">
      <input
        {...resto}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={texto}
        onChange={(e) => {
          const bruto = e.target.value;
          const iso = /^\d{4}-\d{1,2}-\d{1,2}$/.test(bruto.trim()) ? interpretarDataColada(bruto) : null;
          if (iso) {
            setTexto(isoParaBr(iso));
            aoMudar(iso);
            return;
          }
          const m = mascararData(bruto);
          setTexto(m);
          aoMudar(brParaIso(m) ?? "");
        }}
        onPaste={(e) => {
          const iso = interpretarDataColada(e.clipboardData.getData("text"));
          if (!iso) return; // formato desconhecido: deixa o navegador colar e a máscara limpar
          e.preventDefault();
          setTexto(isoParaBr(iso));
          aoMudar(iso);
        }}
        aria-label={ariaLabel}
        data-testid={testid}
        className={cn("box-border block w-full min-w-0 max-w-full pr-12", className)}
      />
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={nome ? `Abrir calendário: ${nome}` : "Abrir calendário"}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-forest hover:bg-sage-50"
        data-testid={testid ? `${testid}-calendario` : undefined}
      >
        <CalendarDays className="h-5 w-5" aria-hidden />
      </button>
      {aberto && (
        <CalendarioBR
          valor={value}
          min={min}
          rotulo={nome}
          dentroDe={caixa}
          testid={testid ? `${testid}-calendario-popup` : "calendario-popup"}
          aoFechar={() => {
            fechar();
            botao.current?.focus();
          }}
          aoEscolher={(iso) => {
            setTexto(isoParaBr(iso));
            aoMudar(iso);
            fechar();
            botao.current?.focus();
          }}
        />
      )}
    </span>
  );
}

/**
 * Campo de data do app. Valor em ISO; `onChange` recebe um evento com `target.value` em ISO, como o campo nativo.
 *  • Toque (celular): o campo nativo (calendário do aparelho) que não estoura o cartão no iPhone (Q3): ocupa a largura
 *    da coluna (regra global em globals.css + `min-w-0 w-full block`). Vazio, o iOS mostra o campo em branco: o texto
 *    de exemplo "dd/mm/aaaa" aparece por cima até a pessoa tocar.
 *  • Computador (E136): `CampoDataTexto`, com o calendário do site em pt-BR.
 */
export function CampoData({
  value,
  className,
  exemplo = "dd/mm/aaaa",
  onChange,
  min,
  name,
  "aria-label": ariaLabel,
  "data-testid": testid,
  ...resto
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min"> & {
  value: string;
  exemplo?: string;
  min?: string;
  "data-testid"?: string;
}) {
  const toque = useToque();
  const vazio = !value;

  if (!toque) {
    return (
      <>
        <CampoDataTexto
          {...resto}
          value={value}
          min={min}
          ariaLabel={ariaLabel}
          testid={testid}
          className={className}
          aoMudar={(iso) => onChange?.({ target: { value: iso }, currentTarget: { value: iso } } as ChangeEvent<HTMLInputElement>)}
        />
        {name && <input type="hidden" name={name} value={value} />}
      </>
    );
  }

  return (
    <span className="relative block w-full min-w-0">
      <input
        {...resto}
        type="date"
        name={name}
        min={min}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        data-testid={testid}
        data-vazio={vazio ? "1" : undefined}
        className={cn("peer block w-full min-w-0 max-w-full", className)}
      />
      {vazio && (
        <span
          aria-hidden
          data-testid="campo-data-exemplo"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted peer-focus:hidden"
        >
          {exemplo}
        </span>
      )}
    </span>
  );
}
