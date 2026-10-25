"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  gradeDoMes,
  hojeIsoBrasilia,
  INICIAIS_SEMANA_BR,
  DIAS_SEMANA_BR,
  mesDe,
  mesVizinho,
  rotuloDiaBR,
  somarDias,
  TEXTOS_CALENDARIO,
  tituloMesBR,
} from "@/lib/calendario/mes-br";
import { cn } from "@/lib/utils";

/**
 * E136: o calendário que abre no botão dos campos de data do computador. O pop-up nativo do navegador (`showPicker`)
 * sai no idioma do NAVEGADOR ("November 2026", "Clear", "Today"); este é do site e sempre em pt-BR: mês, dias da
 * semana (domingo primeiro), rótulo de cada dia para o leitor de tela, "Limpar" e "Hoje". Escape e clique fora fecham;
 * as setas andam pelos dias.
 */
export function CalendarioBR({
  valor,
  min,
  rotulo,
  aoEscolher,
  aoFechar,
  dentroDe,
  testid,
}: {
  /** Data escolhida, em ISO, ou "". */
  valor: string;
  /** Primeiro dia que pode ser escolhido (ISO). */
  min?: string;
  /** O nome do campo, para o leitor de tela ("Calendário: Disponível a partir de"). */
  rotulo?: string;
  aoEscolher: (iso: string) => void;
  aoFechar: () => void;
  /** O campo inteiro (texto + botão): clicar nele não conta como "clique fora". */
  dentroDe: RefObject<HTMLElement | null>;
  testid?: string;
}) {
  const hoje = hojeIsoBrasilia();
  const inicial = valor || (min && min > hoje ? min : hoje);
  const [mes, setMes] = useState(() => mesDe(inicial));
  const [foco, setFoco] = useState(inicial);
  const grade = useRef<HTMLDivElement>(null);
  const bloqueado = (iso: string) => !!min && iso < min;

  // Abre com o foco no dia escolhido (ou hoje), como o calendário do navegador.
  useEffect(() => {
    grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
  }, [foco, mes]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (dentroDe.current && !dentroDe.current.contains(e.target as Node)) aoFechar();
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aoFechar, dentroDe]);

  const irPara = (iso: string) => {
    setFoco(iso);
    setMes(mesDe(iso));
  };

  const teclas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const tid = (s: string) => (testid ? `${testid}-${s}` : undefined);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={rotulo ? `Calendário: ${rotulo}` : "Calendário"}
      data-testid={testid}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          aoFechar();
        } else if (teclas[e.key] && (e.target as HTMLElement).dataset.dia) {
          e.preventDefault();
          irPara(somarDias(foco, teclas[e.key]));
        }
      }}
      className="absolute right-0 top-full z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-3 text-ink shadow-flutuante"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMes(mesVizinho(mes.ano, mes.mes0, -1))}
          aria-label={TEXTOS_CALENDARIO.anterior}
          className="grid h-9 w-9 place-items-center rounded-lg text-forest hover:bg-sage-50"
          data-testid={tid("anterior")}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p className="text-sm font-semibold first-letter:uppercase" aria-live="polite" data-testid={tid("titulo")}>
          {tituloMesBR(mes.ano, mes.mes0)}
        </p>
        <button
          type="button"
          onClick={() => setMes(mesVizinho(mes.ano, mes.mes0, 1))}
          aria-label={TEXTOS_CALENDARIO.proximo}
          className="grid h-9 w-9 place-items-center rounded-lg text-forest hover:bg-sage-50"
          data-testid={tid("proximo")}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div ref={grade} role="grid" aria-label={tituloMesBR(mes.ano, mes.mes0)} className="mt-2">
        <div role="row" className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
          {INICIAIS_SEMANA_BR.map((d, i) => (
            <span key={i} role="columnheader" aria-label={DIAS_SEMANA_BR[i]} title={DIAS_SEMANA_BR[i]} className="py-1" data-testid={tid("dia-semana")}>
              {d}
            </span>
          ))}
        </div>
        {gradeDoMes(mes.ano, mes.mes0).map((semana, s) => (
          <div key={s} role="row" className="mt-1 grid grid-cols-7 gap-1">
            {semana.map((iso, i) =>
              iso ? (
                <span key={iso} role="gridcell" aria-selected={iso === valor}>
                  <button
                    type="button"
                    data-dia={iso}
                    tabIndex={iso === foco ? 0 : -1}
                    disabled={bloqueado(iso)}
                    aria-label={rotuloDiaBR(iso)}
                    aria-current={iso === hoje ? "date" : undefined}
                    onClick={() => aoEscolher(iso)}
                    className={cn(
                      "grid h-9 w-full place-items-center rounded-lg text-sm tabular-nums",
                      iso === valor ? "bg-forest font-semibold text-white" : "hover:bg-sage-50",
                      iso === hoje && iso !== valor && "font-semibold text-forest ring-1 ring-inset ring-sage-200",
                      bloqueado(iso) && "cursor-not-allowed text-muted/50 line-through hover:bg-transparent",
                    )}
                  >
                    {Number(iso.slice(8))}
                  </button>
                </span>
              ) : (
                <span key={`v${s}-${i}`} role="gridcell" aria-hidden />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <button type="button" onClick={() => aoEscolher("")} className="rounded-lg px-3 py-2 text-sm font-medium text-forest hover:bg-sage-50" data-testid={tid("limpar")}>
          {TEXTOS_CALENDARIO.limpar}
        </button>
        <button
          type="button"
          onClick={() => aoEscolher(hoje)}
          disabled={bloqueado(hoje)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-forest hover:bg-sage-50 disabled:cursor-not-allowed disabled:text-muted"
          data-testid={tid("hoje")}
        >
          {TEXTOS_CALENDARIO.hoje}
        </button>
      </div>
    </div>
  );
}
