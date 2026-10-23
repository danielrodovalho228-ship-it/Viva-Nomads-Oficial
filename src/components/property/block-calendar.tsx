"use client";

import { useEffect, useMemo, useState } from "react";
import { useHoje } from "@/lib/use-client-state";
import Link from "next/link";
import { CalendarDays, Loader2, Trash2, Ban } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { segmentosDaPilula, rotuloPilula } from "@/lib/calendario-estadias";
import { getEstadiasDoImovel, type EstadiaCalendario } from "@/lib/data/estadias-calendario";
import {
  mesesCalendario,
  expandirBloqueios,
  type Bloqueio,
} from "@/lib/availability";
import { getBlocks, addBlock, removeBlock, type BlocoDatas } from "@/lib/data/blocks-actions";
import { cn } from "@/lib/utils";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import { CalendarioMes, LegendaCalendario } from "@/components/calendario/calendario-mes";
import { diasDoIntervalo, type MarcaDia } from "@/lib/calendario/grade";
import { ImportarCalendario } from "@/components/property/importar-calendario";

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
  const today = useHoje();
  const [blocks, setBlocks] = useState<BlocoDatas[]>([]);
  // Estadias com contrato (pílulas com o inquilino). Falha aqui não derruba o calendário: fica só com os bloqueios.
  const [estadias, setEstadias] = useState<EstadiaCalendario[]>([]);
  const [sel, setSel] = useState<{ ini: string | null; fim: string | null }>({
    ini: null,
    fim: null,
  });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Carregamento das datas: o indicador SEMPRE some (sucesso ou falha); falha vira aviso com "Tentar de novo".
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    getBlocks(propertyId)
      .then((b) => {
        if (vivo) setBlocks(b);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    getEstadiasDoImovel(propertyId)
      .then((e) => {
        if (vivo) setEstadias(e);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [propertyId, tentativa]);

  function recarregar() {
    setFalhou(false);
    setCarregando(true);
    setTentativa((n) => n + 1);
  }

  const anchor = today;
  const meses = useMemo(() => (anchor ? mesesCalendario(anchor, 3) : []), [anchor]);
  const diasBloqueados = useMemo(
    () => new Set(expandirBloqueios(blocks as Bloqueio[])),
    [blocks]
  );

  // Marcas da grade única (Prompt 43): bloqueio, período selecionado (início e fim em destaque).
  const marcasDoMes: Record<string, MarcaDia[]> = {};
  for (const d of diasBloqueados) marcasDoMes[d] = ["bloqueado"];
  if (sel.ini && sel.fim) for (const d of diasDoIntervalo(sel.ini, sel.fim)) marcasDoMes[d] = [...(marcasDoMes[d] ?? []), "periodo"];
  for (const d of [sel.ini, sel.fim]) if (d) marcasDoMes[d] = ["selecionado", ...(marcasDoMes[d] ?? [])];

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

      {carregando && (
        <div className="mb-3">
          <SkeletonLinhas linhas={2} testid="bloqueios-carregando" />
        </div>
      )}
      {falhou && !carregando && (
        <p role="alert" data-testid="bloqueios-erro" className="mb-3 text-sm text-red-600">
          Não foi possível carregar as datas bloqueadas.{" "}
          <button type="button" onClick={recarregar} className="font-medium underline">
            Tentar de novo
          </button>
        </p>
      )}

      {estadias.length > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-4 rounded-full bg-forest/90" aria-hidden /> Estadia com contrato (toque para abrir)
          </span>
        </p>
      )}

      <LegendaCalendario marcas={["bloqueado", "selecionado", "hoje"]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meses.map(({ year: y, month: m }) => (
          <CalendarioMes
            key={`${y}-${m}`}
            tipo="disponibilidade"
            ano={y}
            mes={m}
            hoje={today}
            marcas={marcasDoMes}
            desabilitado={(iso) => (today ? iso < today : false)}
            onDia={clicar}
            sobreposicao={estadias.flatMap((e) =>
              segmentosDaPilula(e.inicio, e.fim, y, m).map((seg) => (
                <Link
                  key={`${e.contratoId}-${seg.semana}`}
                  href="/dashboard/contratos"
                  data-testid="pilula-estadia"
                  aria-label={rotuloPilula(e.nome, e.inicio, e.fim)}
                  style={{
                    gridRow: seg.semana + 1,
                    gridColumn: `${seg.colIni + 1} / ${seg.colFim + 2}`,
                  }}
                  className={cn(
                    "z-10 flex min-w-0 items-center gap-1 self-end overflow-hidden bg-forest/90 px-1 py-1 text-xs font-semibold text-white",
                    seg.continuaAntes ? "rounded-l-none" : "rounded-l-full",
                    seg.continuaDepois ? "rounded-r-none" : "rounded-r-full"
                  )}
                >
                  {seg.abreAqui && <Avatar name={e.nome} size={16} photoUrl={e.fotoUrl ?? undefined} />}
                  {seg.abreAqui && <span className="min-w-0 truncate">{e.nome}</span>}
                </Link>
              ))
            )}
          />
        ))}
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
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            sel.ini && !busy
              ? "bg-ink text-white hover:bg-ink/90"
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

      <ImportarCalendario propertyId={propertyId} onMudou={recarregar} />

      {/* Lista dos bloqueios */}
      {blocks.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-ink">Datas bloqueadas</p>
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-sage-200 px-3 py-2 text-sm"
                data-testid="bloqueio-item"
                data-origem={b.origem ?? "manual"}
                data-inicio={b.inicio}
              >
                <span className="inline-flex items-center gap-2 text-ink">
                  <Ban className="h-4 w-4 text-red-500" />
                  {brDate(b.inicio)}
                  {b.fim !== b.inicio && <> → {brDate(b.fim)}</>}
                </span>
                {b.origem === "importado" ? (
                  // Prompt 53: vem do calendário de outro site; sai daqui quando sair de lá (ou ao remover o link).
                  <span className="text-xs text-muted" data-testid="bloqueio-importado">Importado</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => remover(b.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
