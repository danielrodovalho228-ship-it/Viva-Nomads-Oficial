"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Loader2, CircleAlert } from "lucide-react";
import type { Property } from "@/lib/types";
import {
  diaDisponivel,
  inicioEfetivo,
  mesesCalendario,
  estadiaLabel,
  validarReserva,
} from "@/lib/availability";
import { solicitarReserva } from "@/lib/data/reservas-actions";
import { useAuthStore } from "@/lib/store";
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
 * Calendário de disponibilidade INTERATIVO (estilo FurnishedFinder). Mostra a
 * janela livre e deixa o inquilino escolher entrada/saída (2 cliques), valida
 * contra a janela + estadia mín/máx + dias bloqueados, e solicita a reserva
 * (abre a conversa com o proprietário). Derivado dos campos do imóvel — leitura
 * + uma ação best-effort. Bloqueios do proprietário chegam via `property.blocks`
 * quando existirem (hoje []).
 */
export function AvailabilityCalendar({ property }: { property: Property }) {
  const user = useAuthStore((s) => s.user);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(ymd(new Date())), []);

  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const from = property.availableFrom?.slice(0, 10) || null;
  const until = property.availableUntil?.slice(0, 10) || null;
  const bloqueados = useMemo(
    () => (property as { blocks?: string[] }).blocks ?? [],
    [property]
  );

  const anchorStr = from || today;
  const meses = useMemo(() => (anchorStr ? mesesCalendario(anchorStr, 3) : []), [anchorStr]);

  if (!anchorStr) return null;

  const fromEff = inicioEfetivo(from, today ?? anchorStr);
  const bloqSet = new Set(bloqueados);

  // Um dia é SELECIONÁVEL se está na janela, não é passado e não está bloqueado.
  const selecionavel = (iso: string) =>
    diaDisponivel(iso, fromEff, until) && !bloqSet.has(iso) && (!today || iso >= today);

  function clicarDia(iso: string) {
    setErroEnvio(null);
    setEnviado(false);
    // 1º clique (ou reinício): define a entrada e limpa a saída.
    if (!checkIn || checkOut) {
      setCheckIn(iso);
      setCheckOut(null);
      return;
    }
    // 2º clique: saída se depois da entrada; senão vira a nova entrada.
    if (iso > checkIn) setCheckOut(iso);
    else {
      setCheckIn(iso);
      setCheckOut(null);
    }
  }

  const reserva =
    checkIn && checkOut
      ? validarReserva({
          checkIn,
          checkOut,
          fromISO: fromEff,
          untilISO: until,
          minDias: property.minPeriodDays,
          maxDias: property.maxPeriodDays,
          bloqueados,
        })
      : null;

  async function reservar() {
    if (!checkIn || !checkOut || !reserva?.ok) return;
    setEnviando(true);
    setErroEnvio(null);
    const r = await solicitarReserva(property.id, checkIn, checkOut);
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setErroEnvio(r.error ?? "Não foi possível solicitar a reserva.");
  }

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
            Disponível — escolha as datas abaixo. Estadia de{" "}
            <strong>{estadiaLabel(property.minPeriodDays, property.maxPeriodDays)}</strong>.
          </>
        )}
      </p>
      <p className="mt-1 text-sm text-muted">
        Toque na <strong>entrada</strong> e depois na <strong>saída</strong> para solicitar uma
        reserva.
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
                  const iso = ymd(new Date(y, m, dia));
                  const podeSelecionar = selecionavel(iso);
                  const isHoje = today === iso;
                  const isIn = checkIn === iso;
                  const isOut = checkOut === iso;
                  const noIntervalo =
                    checkIn && checkOut && iso > checkIn && iso < checkOut;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!podeSelecionar}
                      onClick={() => clicarDia(iso)}
                      aria-label={`${dia} de ${MESES[m]}`}
                      className={cn(
                        "grid aspect-square place-items-center rounded-md text-xs transition-colors",
                        !podeSelecionar && "cursor-not-allowed text-muted/40 line-through",
                        podeSelecionar && "text-forest hover:bg-sage-200",
                        podeSelecionar && !isIn && !isOut && !noIntervalo && "bg-sage-100 font-medium",
                        noIntervalo && "bg-sage-200 font-medium",
                        (isIn || isOut) && "bg-forest font-bold text-white",
                        isHoje && !isIn && !isOut && "ring-2 ring-champagne"
                      )}
                    >
                      {dia}
                    </button>
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
          <span className="h-3 w-3 rounded bg-forest" /> Selecionado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-champagne" /> Hoje
        </span>
      </div>

      {/* Resumo da seleção + solicitar reserva */}
      {checkIn && (
        <div className="mt-4 rounded-2xl border border-sage-200 bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium text-ink">
                {checkOut ? (
                  <>
                    {brDate(checkIn)} → {brDate(checkOut)}
                    {reserva && (
                      <span className="ml-2 text-muted">
                        · {reserva.dias} {reserva.dias === 1 ? "dia" : "dias"}
                      </span>
                    )}
                  </>
                ) : (
                  <>Entrada {brDate(checkIn)} — agora escolha a saída.</>
                )}
              </p>
              {reserva && !reserva.ok && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                  <CircleAlert className="h-3.5 w-3.5" /> {reserva.motivo}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setCheckIn(null);
                setCheckOut(null);
                setEnviado(false);
                setErroEnvio(null);
              }}
              className="text-xs font-medium text-muted underline hover:text-ink"
            >
              Limpar
            </button>
          </div>

          {enviado ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest">
              <Check className="h-4 w-4" /> Solicitação enviada! Continue a conversa em{" "}
              <Link href="/dashboard/mensagens" className="font-medium underline">
                Mensagens
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3">
              {!user ? (
                <Link
                  href={`/auth?redirect=/imoveis/${property.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest/90"
                >
                  Entrar para solicitar reserva
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={reservar}
                  disabled={!reserva?.ok || enviando}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                    reserva?.ok && !enviando
                      ? "bg-forest text-white hover:bg-forest/90"
                      : "cursor-not-allowed bg-sage-200 text-muted"
                  )}
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Solicitar reserva
                </button>
              )}
              {erroEnvio && <p className="mt-2 text-sm text-red-600">{erroEnvio}</p>}
              <p className="mt-2 text-xs text-muted">
                A solicitação abre a conversa com o proprietário — o pagamento é combinado
                direto com ele. A plataforma não retém valores.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
