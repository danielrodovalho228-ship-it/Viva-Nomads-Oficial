"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List, LogIn, LogOut, Lock, MapPin, Video, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Avatar } from "@/components/ui/avatar";
import { ImportarCalendario } from "@/components/property/importar-calendario";
import { ExportarCalendario } from "@/components/property/exportar-calendario";
import {
  LEGENDA_AGENDA,
  ROTULO_TIPO_AGENDA,
  agruparPorDia,
  diaBrasilia,
  estadoDoDia,
  filtrarPorImovel,
  gradeDoMes,
  horaBrasilia,
  mesTemItens,
  moverMes,
  tituloDoMes,
  visitaAConfirmar,
  type ItemAgenda,
} from "@/lib/agenda";
import { STATUS_VISITA_ROTULO, type StatusVisita } from "@/lib/visitas-video";
import { cn } from "@/lib/utils";
import { AcoesDaVisita, AcoesDoDia } from "./acoes-do-dia";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const TOM: Record<ItemAgenda["tipo"], string> = {
  visita: "bg-blue-50 text-blue-800",
  entrada: "bg-forest text-white",
  saida: "bg-forest text-white",
  estadia: "bg-forest text-white",
  bloqueio: "bg-slate-200 text-ink",
};

function Icone({ i }: { i: ItemAgenda }) {
  const C = i.tipo === "visita" ? (i.modalidade === "presencial" ? MapPin : Video) : i.tipo === "entrada" ? LogIn : i.tipo === "saida" ? LogOut : i.tipo === "estadia" ? CalendarDays : Lock;
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

function Linha({ i, acoes }: { i: ItemAgenda; acoes?: boolean }) {
  const hora = horaBrasilia(i.quando);
  const conteudo = (
    <div className="flex min-w-0 items-center gap-3">
      {i.pessoa ? (
        <Avatar name={i.pessoa.nome} size={32} photoUrl={i.pessoa.fotoUrl ?? undefined} />
      ) : (
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", TOM[i.tipo], visitaAConfirmar(i) && "border border-dashed border-blue-600 bg-white")}>
          <Icone i={i} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">
          {hora && <span className="mr-2 tabular-nums">{hora}</span>}
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
    <li data-testid="agenda-item" data-tipo={i.tipo} data-id={i.id} className="py-1">
      {i.href ? (
        <Link href={i.href} className="block rounded-lg px-2 py-2 hover:bg-surface-2">
          {conteudo}
        </Link>
      ) : (
        <div className="px-2 py-2">{conteudo}</div>
      )}
      {acoes && i.tipo === "visita" && <AcoesDaVisita i={i} />}
    </li>
  );
}

/** Legenda fixa sob a grade (item 1): cor + ícone de cada estado. */
function Legenda() {
  const amostra: Record<(typeof LEGENDA_AGENDA)[number], { classe: string; icone: LucideIcon }> = {
    Estadia: { classe: "bg-forest text-white", icone: CalendarDays },
    Entrada: { classe: "bg-forest text-white", icone: LogIn },
    Saída: { classe: "bg-forest text-white", icone: LogOut },
    Bloqueado: { classe: "bg-slate-200 text-ink", icone: Lock },
    Visita: { classe: "border border-blue-600 bg-blue-50 text-blue-800", icone: Video },
    "Visita a confirmar": { classe: "border border-dashed border-blue-600 bg-white text-blue-800", icone: Video },
  };
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink" data-testid="agenda-legenda" aria-label="Legenda">
      {LEGENDA_AGENDA.map((nome) => {
        const { classe, icone: I } = amostra[nome];
        return (
          <li key={nome} className="inline-flex items-center gap-2" data-testid="agenda-legenda-item">
            <span className={cn("grid h-6 w-6 place-items-center rounded-lg", classe)} aria-hidden>
              <I className="h-3.5 w-3.5" />
            </span>
            {nome}
          </li>
        );
      })}
    </ul>
  );
}

/** Uma célula do mês: faixa da estadia (contínua, com entrada/saída), dia bloqueado sombreado, visitas com hora. */
function Celula({
  dia,
  doMes,
  hoje,
  aberto,
  itens,
  compacta,
  onAbrir,
}: {
  dia: string;
  doMes: boolean;
  hoje: string;
  aberto: boolean;
  itens: ItemAgenda[];
  compacta: boolean;
  onAbrir: () => void;
}) {
  const estado = estadoDoDia(itens, dia);
  const bloqueado = estado.bloqueios.length > 0;
  const estadia = estado.estadias[0];
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-testid={`agenda-dia-${dia}`}
      data-qtd={itens.length}
      data-bloqueado={bloqueado ? "1" : undefined}
      data-estadia={estadia ? (estadia.entrada ? "entrada" : estadia.saida ? "saida" : "meio") : undefined}
      data-hoje={dia === hoje ? "1" : undefined}
      aria-label={`${dataLonga(dia)}: ${itens.length} ${itens.length === 1 ? "item" : "itens"}${bloqueado ? ", bloqueado" : ""}${estadia ? ", estadia" : ""}`}
      aria-pressed={aberto}
      className={cn(
        "relative min-w-0 border-b border-r border-sage-200 p-1 text-left align-top",
        compacta ? "min-h-12 sm:min-h-16" : "min-h-16 sm:min-h-24",
        bloqueado ? "bg-slate-200" : doMes ? "bg-white" : "bg-surface-2",
        !doMes && "text-muted",
        aberto && "outline outline-2 -outline-offset-2 outline-forest",
      )}
    >
      <span className="flex items-center justify-between">
        <span
          className={cn(
            "grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums",
            dia === hoje && "bg-ink text-white",
          )}
        >
          {Number(dia.slice(8, 10))}
        </span>
        {bloqueado && <Lock className="h-3.5 w-3.5 text-muted" aria-hidden data-testid="agenda-dia-cadeado" />}
      </span>
      {/* Visitas: marcador com a hora (no celular, só o ícone); a confirmar = borda tracejada. */}
      <span className="mt-1 flex flex-col gap-1">
        {estado.visitas.slice(0, 2).map((v) => (
          <span
            key={v.id}
            data-testid="agenda-marcador-visita"
            data-a-confirmar={visitaAConfirmar(v) ? "1" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-1 rounded-lg px-1 text-[11px] leading-5 text-blue-800",
              visitaAConfirmar(v) ? "border border-dashed border-blue-600 bg-white" : "border border-blue-600 bg-blue-50",
            )}
          >
            <Icone i={v} />
            <span className="hidden truncate tabular-nums sm:inline">{horaBrasilia(v.quando)}</span>
          </span>
        ))}
        {estado.visitas.length > 2 && <span className="text-[11px] text-muted">+{estado.visitas.length - 2}</span>}
      </span>
      {/* Estadia: faixa contínua de ponta a ponta da célula (passa por cima das bordas), arredondada na entrada e na saída. */}
      {estadia && (
        <span
          data-testid="agenda-faixa-estadia"
          className={cn(
            "absolute bottom-1 z-10 flex h-5 items-center gap-1 bg-forest px-1 text-[11px] font-semibold text-white",
            estadia.entrada ? "left-1 rounded-l-full" : "-left-px",
            estadia.saida ? "right-1 rounded-r-full" : "-right-px",
          )}
        >
          {estadia.entrada && <LogIn className="h-3 w-3 shrink-0" aria-label="Entrada" data-testid="agenda-icone-entrada" />}
          {estadia.entrada && estadia.item.pessoa && <span className="hidden min-w-0 truncate sm:inline">{estadia.item.pessoa.nome}</span>}
          {estadia.saida && <LogOut className="ml-auto h-3 w-3 shrink-0" aria-label="Saída" data-testid="agenda-icone-saida" />}
        </span>
      )}
    </button>
  );
}

/** Bloco de sincronização (item 3): os MESMOS componentes da edição do anúncio, por imóvel. */
function Sincronizacao({ imovel, destaque, onMudou }: { imovel: string | null; destaque: boolean; onMudou: () => void }) {
  return (
    <section
      data-testid="agenda-sincronizacao"
      data-destaque={destaque ? "1" : undefined}
      className={cn("min-w-0 rounded-xl border bg-white p-4", destaque ? "border-forest" : "border-line")}
    >
      <h2 className="font-title text-base font-semibold text-ink">Sincronizar com Airbnb e Booking</h2>
      {imovel ? (
        <>
          <ImportarCalendario key={`imp-${imovel}`} propertyId={imovel} onMudou={onMudou} />
          <ExportarCalendario key={`exp-${imovel}`} propertyId={imovel} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted" data-testid="agenda-sincronizacao-escolher">
          Escolha um imóvel no filtro para trazer o calendário de outro site ou copiar o link deste.
        </p>
      )}
    </section>
  );
}

export function AgendaClient({ itens, imoveis, hojeISO }: { itens: ItemAgenda[]; imoveis: { id: string; titulo: string }[]; hojeISO: string }) {
  const hoje = diaBrasilia(hojeISO) ?? hojeISO.slice(0, 10);
  const [vista, setVista] = useState<"mes" | "lista">("mes");
  // Com um imóvel só, ele já vem escolhido (as ações do dia e a sincronização pedem um imóvel).
  const [imovel, setImovel] = useState<string>(imoveis.length === 1 ? imoveis[0].id : "");
  const [cursor, setCursor] = useState({ ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) });
  const [diaAberto, setDiaAberto] = useState<string>(hoje);
  const router = useRouter();

  const doImovel = useMemo(() => filtrarPorImovel(itens, imovel || null), [itens, imovel]);
  const porDia = useMemo(() => agruparPorDia(doImovel), [doImovel]);
  const semanas = gradeDoMes(cursor.ano, cursor.mes);
  const comItens = mesTemItens(porDia, cursor.ano, cursor.mes);
  // "Próximos": a estadia aparece pela entrada e pela saída (não repete em todos os dias).
  const proximos = [...porDia.entries()]
    .filter(([d]) => d >= hoje)
    .map(([d, l]) => [d, l.filter((i) => i.tipo !== "estadia")] as const)
    .filter(([, l]) => l.length > 0);
  const doDiaAberto = porDia.get(diaAberto) ?? [];
  const estadoAberto = estadoDoDia(doDiaAberto, diaAberto);
  const nadaMarcado = doImovel.length === 0;

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
            className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm", vista === "mes" ? "bg-forest text-white" : "text-ink")}
          >
            <CalendarDays className="h-4 w-4" /> Mês
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === "lista"}
            onClick={() => setVista("lista")}
            data-testid="agenda-vista-lista"
            className={cn("inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm", vista === "lista" ? "bg-forest text-white" : "text-ink")}
          >
            <List className="h-4 w-4" /> Próximos
          </button>
        </div>
        <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
          Imóvel
          <select
            value={imovel}
            onChange={(e) => setImovel(e.target.value)}
            data-testid="agenda-filtro-imovel"
            className="min-w-0 max-w-[14rem] rounded-lg border border-sage-200 bg-white px-2 py-2 text-sm text-ink"
          >
            {imoveis.length > 1 && <option value="">Todos os imóveis</option>}
            {imoveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {imovel && nadaMarcado && (
        <p className="text-sm text-ink" data-testid="agenda-dica-vazia">
          Toque num dia para bloquear datas ou traga o calendário do Airbnb.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {vista === "mes" ? (
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <button type="button" aria-label="Mês anterior" data-testid="agenda-anterior" onClick={() => setCursor(moverMes(cursor.ano, cursor.mes, -1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="font-title text-base font-semibold text-ink" data-testid="agenda-mes-titulo">
                {tituloDoMes(cursor.ano, cursor.mes)}
              </h2>
              <button type="button" aria-label="Próximo mês" data-testid="agenda-proximo" onClick={() => setCursor(moverMes(cursor.ano, cursor.mes, 1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
              {SEMANA.map((s) => (
                <span key={s} className="py-1">
                  {s}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 overflow-hidden rounded-lg border-l border-t border-sage-200" data-testid="agenda-grade" data-compacta={comItens ? undefined : "1"}>
              {semanas.flat().map(({ dia, doMes }) => (
                <Celula
                  key={dia}
                  dia={dia}
                  doMes={doMes}
                  hoje={hoje}
                  aberto={dia === diaAberto}
                  itens={porDia.get(dia) ?? []}
                  compacta={!comItens}
                  onAbrir={() => setDiaAberto(dia)}
                />
              ))}
            </div>
            <Legenda />
            <div className="mt-4 border-t border-sage-200 pt-3" data-testid="agenda-dia-aberto">
              <h3 className="text-sm font-semibold text-ink">{dataLonga(diaAberto)}</h3>
              {doDiaAberto.some((i) => i.tipo !== "estadia" && i.tipo !== "bloqueio") && (
                <ul className="mt-1 divide-y divide-sage-100">
                  {doDiaAberto
                    .filter((i) => i.tipo !== "estadia" && i.tipo !== "bloqueio")
                    .map((i) => (
                      <Linha key={i.id} i={i} acoes />
                    ))}
                </ul>
              )}
              <AcoesDoDia key={`${diaAberto}-${imovel}`} dia={diaAberto} hoje={hoje} estado={estadoAberto} imovel={imovel || null} itensDoImovel={doImovel} />
              {estadoAberto.visitas.length > 0 && (
                <Link href="/dashboard/visitas" className="mt-3 inline-block text-sm font-semibold text-forest underline underline-offset-4" data-testid="agenda-ver-visitas">
                  Ver todas as visitas
                </Link>
              )}
            </div>
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
                        <Linha key={`${dia}-${i.id}`} i={i} acoes />
                      ))}
                    </ul>
                  </section>
                ))}
                <Link href="/dashboard/visitas" className="inline-block text-sm font-semibold text-forest underline underline-offset-4" data-testid="agenda-ver-visitas">
                  Ver todas as visitas
                </Link>
              </div>
            )}
          </Panel>
        )}
        <Sincronizacao imovel={imovel || null} destaque={!!imovel && nadaMarcado} onMudou={() => router.refresh()} />
      </div>
    </div>
  );
}
