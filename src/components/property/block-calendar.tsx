"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Trash2, Ban } from "lucide-react";
import {
  mesesCalendario,
  expandirBloqueios,
  type Bloqueio,
} from "@/lib/availability";
import { getBlocks, addBlock, removeBlock, type BlocoDatas } from "@/lib/data/blocks-actions";
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
 * Editor de DATAS BLOQUEADAS (lado do proprietário). O dono seleciona um período
 * (2 cliques) e bloqueia; os dias já bloqueados ficam marcados. Os bloqueios são
 * lidos pelo calendário público (dias indisponíveis) e pela validação de reserva.
 */
export function BlockCalendar({ propertyId }: { propertyId: string }) {
  const [today, setToday] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlocoDatas[]>([]);
  const [sel, setSel] = useState<{ ini: string | null; fim: string | null }>({
    ini: null,
    fim: null,
  });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setToday(ymd(new Date()));
    getBlocks(propertyId).then(setBlocks).catch(() => {});
  }, [propertyId]);

  const anchor = today;
  const meses = useMemo(() => (anchor ? mesesCalendario(anchor, 3) : []), [anchor]);
  const diasBloqueados = useMemo(
    () => new Set(expandirBloqueios(blocks as Bloqueio[])),
    [blocks]
  );

  if (!anchor) return null;

  function clicar(iso: string) {
    setErro(null);
    if (!sel.ini || sel.fim) {
      setSel({ ini: iso, fim: null });
    } else if (iso >= sel.ini) {
      setSel({ ini: sel.ini, fim: iso });
    } else {
      setSel({ ini: iso, fim: null });
    }
  }

  async function bloquear() {
    if (!sel.ini) return;
    const fim = sel.fim ?? sel.ini;
    setBusy(true);
    setErro(null);
    const r = await addBlock(propertyId, sel.ini, fim);
    if (r.ok) {
      // Atualiza otimista (demo) ou recarrega (real).
      const novo = await getBlocks(propertyId);
      setBlocks(
        novo.length
          ? novo
          : [...blocks, { id: r.id ?? `tmp-${sel.ini}-${fim}`, inicio: sel.ini, fim }]
      );
      setSel({ ini: null, fim: null });
    } else {
      setErro(r.error ?? "Não foi possível bloquear.");
    }
    setBusy(false);
  }

  async function remover(id: string) {
    setBusy(true);
    const r = await removeBlock(id);
    if (r.ok) setBlocks((b) => b.filter((x) => x.id !== id));
    else setErro(r.error ?? "Não foi possível remover.");
    setBusy(false);
  }

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm text-muted">
        <CalendarDays className="h-4 w-4 text-sage" />
        Toque no início e no fim de um período para <strong>bloquear</strong> (o imóvel fica
        indisponível nessas datas na busca e na reserva).
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map((mes) => {
          const y = mes.year;
          const m = mes.month;
          const primeiro = new Date(y, m, 1).getDay();
          const diasNoMes = new Date(y, m + 1, 0).getDate();
          const celulas: (number | null)[] = [
            ...Array(primeiro).fill(null),
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
                  const passado = today ? iso < today : false;
                  const bloqueado = diasBloqueados.has(iso);
                  const isIni = sel.ini === iso;
                  const isFim = sel.fim === iso;
                  const entre = sel.ini && sel.fim && iso > sel.ini && iso < sel.fim;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={passado}
                      onClick={() => clicar(iso)}
                      className={cn(
                        "grid aspect-square place-items-center rounded-md text-xs transition-colors",
                        passado && "cursor-not-allowed text-muted/30",
                        !passado && "text-ink hover:bg-sage-100",
                        bloqueado && "bg-red-100 text-red-700 line-through",
                        entre && "bg-amber-100",
                        (isIni || isFim) && "bg-amber-500 font-bold text-white"
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

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {sel.ini && (
          <span className="text-sm text-ink">
            Período: <strong>{brDate(sel.ini)}</strong>
            {sel.fim && (
              <>
                {" "}→ <strong>{brDate(sel.fim)}</strong>
              </>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={bloquear}
          disabled={!sel.ini || busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            sel.ini && !busy
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "cursor-not-allowed bg-surface-2 text-muted"
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          Bloquear período
        </button>
        {sel.ini && (
          <button
            type="button"
            onClick={() => setSel({ ini: null, fim: null })}
            className="text-xs font-medium text-muted underline hover:text-ink"
          >
            Cancelar
          </button>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}

      {/* Lista dos bloqueios */}
      {blocks.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-ink">Datas bloqueadas</p>
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-sage-200 px-3 py-2 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-ink">
                  <Ban className="h-4 w-4 text-red-500" />
                  {brDate(b.inicio)}
                  {b.fim !== b.inicio && <> → {brDate(b.fim)}</>}
                </span>
                <button
                  type="button"
                  onClick={() => remover(b.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
