"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { Property } from "@/lib/types";
import {
  diaDisponivel,
  inicioEfetivo,
  mesesCalendario,
  estadiaLabel,
} from "@/lib/availability";
import { cn } from "@/lib/utils";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * Calendário de disponibilidade (inspirado no FurnishedFinder): mostra, de forma
 * visual, quando o imóvel está livre — a janela `availableFrom → availableUntil`
 * destacada nos próximos 3 meses, mais a estadia mínima/máxima. Derivado só dos
 * campos que já existem no imóvel (sem migração). Componente de leitura.
 */
export function AvailabilityCalendar({ property }: { property: Property }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(ymd(new Date())), []);

  const from = property.availableFrom?.slice(0, 10) || null;
  const until = property.availableUntil?.slice(0, 10) || null;

  // Âncora: mês da disponibilidade (ou o mês atual). Sem `from`, aguarda o mount
  // para não haver divergência de hidratação com a data "hoje".
  const anchorStr = from || today;

  const meses = useMemo(() => (anchorStr ? mesesCalendario(anchorStr, 3) : []), [anchorStr]);

  if (!anchorStr) return null;

  // Início efetivo: a data do anúncio, ou "hoje" quando não há data.
  const fromEff = inicioEfetivo(from, today ?? anchorStr);

  return (
    <section aria-labelledby="disp-title">
      <h2 id="disp-title" className="flex items-center gap-2 font-title text-2xl font-bold text-ink">
        <CalendarDays className="h-6 w-6 text-forest" /> Disponibilidade
      </h2>
      <p className="mt-2 text-ink/90">
        {from ? (
          <>
            Disponível a partir de <strong>{brDate(from)}</strong>
            {until && (
              <>
                {" "}até <strong>{brDate(until)}</strong>
              </>
            )}
            . Estadia de{" "}
            <strong>{estadiaLabel(property.minPeriodDays, property.maxPeriodDays)}</strong>.
          </>
        ) : (
          <>
            Disponível — combine as datas direto com o proprietário. Estadia de{" "}
            <strong>{estadiaLabel(property.minPeriodDays, property.maxPeriodDays)}</strong>.
          </>
        )}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map((mes) => {
          const y = mes.year;
          const m = mes.month;
          const primeiroDiaSemana = new Date(y, m, 1).getDay();
          const diasNoMes = new Date(y, m + 1, 0).getDate();
          const celulas: (number | null)[] = [
            ...Array(primeiroDiaSemana).fill(null),
            ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
          ];
          return (
            <div key={`${y}-${m}`} className="rounded-2xl border border-sage-200 p-3">
              <p className="mb-2 text-center text-sm font-semibold capitalize text-ink">
                {MESES[m]} {y}
              </p>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted">
                {DIAS.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-0.5">
                {celulas.map((dia, i) => {
                  if (dia === null) return <span key={i} />;
                  const diaISO = ymd(new Date(y, m, dia));
                  const disponivel = diaDisponivel(diaISO, fromEff, until);
                  const isHoje = today === diaISO;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "grid aspect-square place-items-center rounded-md text-xs",
                        disponivel ? "bg-sage-100 font-medium text-forest" : "text-muted/50",
                        isHoje && "ring-2 ring-champagne"
                      )}
                    >
                      {dia}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-sage-100" /> Disponível
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-champagne" /> Hoje
        </span>
      </div>
    </section>
  );
}
