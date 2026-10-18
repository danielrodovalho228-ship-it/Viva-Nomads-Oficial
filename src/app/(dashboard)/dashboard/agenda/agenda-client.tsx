"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List, LogIn, LogOut, Lock, MapPin, Video } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Avatar } from "@/components/ui/avatar";
import {
  ROTULO_TIPO_AGENDA,
  agruparPorDia,
  diaBrasilia,
  filtrarPorImovel,
  gradeDoMes,
  horaBrasilia,
  moverMes,
  type ItemAgenda,
} from "@/lib/agenda";
import { STATUS_VISITA_ROTULO, type StatusVisita } from "@/lib/visitas-video";
import { cn } from "@/lib/utils";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const TOM: Record<ItemAgenda["tipo"], string> = {
  visita: "bg-blue-50 text-blue-800",
  entrada: "bg-emerald-100 text-emerald-800",
  saida: "bg-amber-100 text-amber-900",
  bloqueio: "bg-slate-200 text-slate-700",
};

function Icone({ i }: { i: ItemAgenda }) {
  const C = i.tipo === "visita" ? (i.modalidade === "presencial" ? MapPin : Video) : i.tipo === "entrada" ? LogIn : i.tipo === "saida" ? LogOut : Lock;
  return <C className="h-3.5 w-3.5 shrink-0" aria-hidden />;
}

function rotulo(i: ItemAgenda): string {
  if (i.tipo !== "visita") return ROTULO_TIPO_AGENDA[i.tipo];
  const st = i.status && i.status in STATUS_VISITA_ROTULO ? STATUS_VISITA_ROTULO[i.status as StatusVisita] : "";
  return `Visita ${i.modalidade === "presencial" ? "presencial" : "por vídeo"}${st ? ` · ${st}` : ""}`;
}

function dataLonga(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const sem = SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${sem}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function Linha({ i }: { i: ItemAgenda }) {
  const hora = horaBrasilia(i.quando);
  const conteudo = (
    <div className="flex min-w-0 items-center gap-3">
      {i.pessoa ? (
        <Avatar name={i.pessoa.nome} size={32} photoUrl={i.pessoa.fotoUrl ?? undefined} />
      ) : (
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", TOM[i.tipo])}>
          <Icone i={i} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {hora && <span className="mr-1.5 tabular-nums">{hora}</span>}
          {rotulo(i)}
        </p>
        <p className="truncate text-xs text-muted">
          {i.imovel}
          {i.tipo !== "bloqueio" && (
            <>
              {" · "}
              <span data-testid="agenda-item-pessoa">{i.pessoa ? i.pessoa.nome : "Interessado(a)"}</span>
            </>
          )}
          {i.tipo === "bloqueio" && i.ate && i.ate !== i.quando && ` · até ${i.ate.slice(8, 10)}/${i.ate.slice(5, 7)}`}
        </p>
      </div>
    </div>
  );
  return (
    <li data-testid="agenda-item" data-tipo={i.tipo} data-id={i.id}>
      {i.href ? (
        <Link href={i.href} className="block rounded-lg px-2 py-2 hover:bg-surface-2">
          {conteudo}
        </Link>
      ) : (
        <div className="px-2 py-2">{conteudo}</div>
      )}
    </li>
  );
}

export function AgendaClient({ itens, imoveis, hojeISO }: { itens: ItemAgenda[]; imoveis: { id: string; titulo: string }[]; hojeISO: string }) {
  const hoje = diaBrasilia(hojeISO) ?? hojeISO.slice(0, 10);
  const [vista, setVista] = useState<"mes" | "lista">("mes");
  const [imovel, setImovel] = useState<string>("");
  const [cursor, setCursor] = useState({ ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) });
  const [diaAberto, setDiaAberto] = useState<string>(hoje);

  const porDia = useMemo(() => agruparPorDia(filtrarPorImovel(itens, imovel || null)), [itens, imovel]);
  const semanas = gradeDoMes(cursor.ano, cursor.mes);
  const prefixoMes = `${cursor.ano}-${String(cursor.mes).padStart(2, "0")}`;
  const proximos = [...porDia.entries()].filter(([d]) => d >= hoje);

  return (
    <div className="space-y-4" data-testid="agenda">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-sage-200 bg-white p-1" role="tablist" aria-label="Vista da agenda">
          <button
            type="button"
            role="tab"
            aria-selected={vista === "mes"}
            onClick={() => setVista("mes")}
            data-testid="agenda-vista-mes"
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", vista === "mes" ? "bg-forest text-white" : "text-ink")}
          >
            <CalendarDays className="h-4 w-4" /> Mês
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === "lista"}
            onClick={() => setVista("lista")}
            data-testid="agenda-vista-lista"
            className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", vista === "lista" ? "bg-forest text-white" : "text-ink")}
          >
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
        <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
          Imóvel
          <select
            value={imovel}
            onChange={(e) => setImovel(e.target.value)}
            data-testid="agenda-filtro-imovel"
            className="min-w-0 max-w-[14rem] rounded-lg border border-sage-200 bg-white px-2 py-1.5 text-sm text-ink"
          >
            <option value="">Todos os imóveis</option>
            {imoveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {vista === "mes" ? (
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" data-testid="agenda-anterior" onClick={() => setCursor(moverMes(cursor.ano, cursor.mes, -1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="font-title text-base font-bold capitalize text-ink" data-testid="agenda-mes-titulo">
              {MESES[cursor.mes - 1]} de {cursor.ano}
            </h2>
            <button type="button" aria-label="Próximo mês" data-testid="agenda-proximo" onClick={() => setCursor(moverMes(cursor.ano, cursor.mes, 1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
            {SEMANA.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {semanas.flat().map(({ dia, doMes }) => {
              const doDia = porDia.get(dia) ?? [];
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setDiaAberto(dia)}
                  data-testid={`agenda-dia-${dia}`}
                  data-qtd={doDia.length}
                  aria-label={`${dataLonga(dia)}: ${doDia.length} ${doDia.length === 1 ? "item" : "itens"}`}
                  className={cn(
                    "min-h-14 min-w-0 rounded-lg border p-1 text-left align-top sm:min-h-24",
                    doMes ? "border-sage-200 bg-white" : "border-transparent bg-surface-2 text-muted",
                    dia === diaAberto && "ring-2 ring-forest",
                  )}
                >
                  <span className={cn("block text-xs font-semibold", dia === hoje && "text-forest underline")}>{Number(dia.slice(8, 10))}</span>
                  {/* Celular: pontos coloridos; computador: até 3 linhas curtas. */}
                  <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {doDia.slice(0, 4).map((i) => (
                      <span key={i.id} className={cn("h-1.5 w-1.5 rounded-full", i.tipo === "visita" ? "bg-blue-500" : i.tipo === "entrada" ? "bg-emerald-500" : i.tipo === "saida" ? "bg-amber-500" : "bg-slate-400")} />
                    ))}
                  </span>
                  <span className="mt-1 hidden space-y-0.5 sm:block">
                    {doDia.slice(0, 3).map((i) => (
                      <span key={i.id} className={cn("flex min-w-0 items-center gap-1 truncate rounded px-1 py-0.5 text-[11px]", TOM[i.tipo])}>
                        <Icone i={i} />
                        <span className="truncate">{horaBrasilia(i.quando) ?? ROTULO_TIPO_AGENDA[i.tipo]}</span>
                      </span>
                    ))}
                    {doDia.length > 3 && <span className="block text-[11px] text-muted">+{doDia.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-sage-200 pt-3" data-testid="agenda-dia-aberto">
            <h3 className="text-sm font-semibold text-ink">{dataLonga(diaAberto)}</h3>
            {(porDia.get(diaAberto) ?? []).length === 0 ? (
              <p className="mt-1 text-sm text-muted">Nada marcado neste dia.</p>
            ) : (
              <ul className="mt-1 divide-y divide-sage-100">
                {(porDia.get(diaAberto) ?? []).map((i) => (
                  <Linha key={i.id} i={i} />
                ))}
              </ul>
            )}
          </div>
          {!diaAberto.startsWith(prefixoMes) && <p className="sr-only">O dia aberto é de outro mês.</p>}
        </Panel>
      ) : (
        <Panel>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted" data-testid="agenda-lista-vazia">
              Nada marcado daqui para a frente.
            </p>
          ) : (
            <div className="space-y-4" data-testid="agenda-lista">
              {proximos.map(([dia, lista]) => (
                <section key={dia}>
                  <h3 className="text-sm font-semibold text-ink">{dataLonga(dia)}</h3>
                  <ul className="mt-1 divide-y divide-sage-100">
                    {lista.map((i) => (
                      <Linha key={`${dia}-${i.id}`} i={i} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
