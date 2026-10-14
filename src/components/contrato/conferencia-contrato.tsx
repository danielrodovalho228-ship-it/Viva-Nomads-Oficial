"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  anexarLaudoConferencia,
  enviarFotoConferencia,
  registrarItemConferencia,
  responderConferencia,
  type ConferenciaView,
  type ConferenciasContrato,
} from "@/lib/data/conferencia-actions";
import type { TipoConferencia } from "@/lib/conferencia";

const ROTULO_TIPO: Record<TipoConferencia, string> = { entrada: "Conferência de entrada", saida: "Conferência de saída" };
const ROTULO_ESTADO = {
  em_andamento: "Em andamento",
  aguardando_outra_parte: "Aguardando a outra parte",
  confirmada: "Confirmada pelas duas partes",
  contestada: "Contestada",
} as const;
const ROTULO_PARTE = { proprietario: "Proprietário", inquilino: "Inquilino" } as const;

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/**
 * Conferência de entrada e de saída, nos dois painéis (ordens 404cd213 e d3c60126).
 * Fotos e itens por cômodo; cada parte confirma ou contesta uma vez; depois disso nada muda.
 * O laudo independente (PDF) prevalece sobre as fotos quando existe.
 */
export function ConferenciaContrato({ contratoId, statusContrato, dados }: { contratoId: string; statusContrato: string; dados: ConferenciasContrato }) {
  const tipos: TipoConferencia[] = statusContrato === "ativo" ? ["entrada", "saida"] : ["saida"];
  return (
    <div className="space-y-4" data-testid="conferencia">
      {tipos.map((t) => (
        <Bloco key={t} contratoId={contratoId} tipo={t} dados={dados} conf={dados.conferencias.find((c) => c.tipo === t) ?? null} />
      ))}
    </div>
  );
}

function Bloco({ contratoId, tipo, dados, conf }: { contratoId: string; tipo: TipoConferencia; dados: ConferenciasContrato; conf: ConferenciaView | null }) {
  const router = useRouter();
  const [comodo, setComodo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [contestando, setContestando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const parte = dados.minhaParte;
  const respondeu = !!conf?.respostas.some((r) => r.parte === parte);
  const travada = (conf?.respostas.length ?? 0) > 0;
  const estado = conf?.estado ?? "em_andamento";

  async function rodar(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await fn();
      if (!r.ok) return setErro(r.error ?? "Não foi possível concluir.");
      setComodo("");
      setDescricao("");
      setFoto(null);
      setMotivo("");
      setContestando(false);
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    rodar(async () => {
      let fotoPath: string | null = null;
      if (foto) {
        const fd = new FormData();
        fd.set("contratoId", contratoId);
        fd.set("arquivo", foto);
        const up = await enviarFotoConferencia(fd);
        if (!up.ok) return up;
        fotoPath = up.path ?? null;
      }
      return registrarItemConferencia({ contratoId, tipo, comodo, descricao, fotoPath });
    });
  };

  const anexarLaudo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    rodar(() => {
      const fd = new FormData();
      fd.set("contratoId", contratoId);
      fd.set("tipo", tipo);
      fd.set("arquivo", arquivo);
      return anexarLaudoConferencia(fd);
    });
  };

  return (
    <section className="rounded-xl border border-line p-4" data-testid={`conferencia-${tipo}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-title text-base font-bold text-ink">{ROTULO_TIPO[tipo]}</h3>
        <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest" data-testid={`conferencia-${tipo}-estado`}>
          {ROTULO_ESTADO[estado]}
        </span>
      </div>
      {tipo === "entrada" && dados.prazoEntradaEm && (
        <p className="mt-1 text-xs text-muted">Registre fotos e itens por cômodo até {fmt(dados.prazoEntradaEm)} (48 h depois do início).</p>
      )}

      {conf?.laudo && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-sage-50 p-3 text-sm text-ink" data-testid="conferencia-laudo">
          <FileCheck2 className="h-4 w-4 shrink-0 text-forest" />
          <span>
            <strong>Laudo independente</strong> anexado em {fmt(conf.laudo.criadoEm)} — prevalece sobre as fotos.{" "}
            {conf.laudo.url && (
              <a href={conf.laudo.url} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">
                Abrir PDF
              </a>
            )}
          </span>
        </p>
      )}

      {conf && conf.itens.length > 0 ? (
        <ul className="mt-3 divide-y divide-line text-sm" data-testid={`conferencia-${tipo}-itens`}>
          {conf.itens.map((i) => (
            <li key={i.id} className="flex items-start gap-3 py-2">
              {i.fotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.fotoUrl} alt={`Foto: ${i.comodo}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-ink">{i.comodo}</p>
                <p className="break-words text-muted">{i.descricao}</p>
                <p className="text-xs text-muted">
                  {ROTULO_PARTE[i.parte]} · {fmt(i.criadoEm)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nenhum item registrado ainda.</p>
      )}

      {conf && conf.respostas.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink" data-testid={`conferencia-${tipo}-respostas`}>
          {conf.respostas.map((r) => (
            <li key={r.parte}>
              {ROTULO_PARTE[r.parte]} {r.decisao === "confirmou" ? "confirmou" : "contestou"} em {fmt(r.decididoEm)}
              {r.motivo ? ` — ${r.motivo}` : ""}
            </li>
          ))}
        </ul>
      )}

      {parte && !travada && (
        <form onSubmit={adicionar} className="mt-4 grid gap-2" data-testid={`conferencia-${tipo}-form`}>
          <input value={comodo} onChange={(e) => setComodo(e.target.value)} maxLength={60} placeholder="Cômodo (ex.: Sala)" aria-label="Cômodo" className="h-11 rounded-lg border border-line px-3 text-sm" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} rows={2} placeholder="Itens e estado do cômodo" aria-label="Itens e estado do cômodo" className="rounded-lg border border-line p-3 text-sm" />
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} aria-label="Foto do cômodo" className="text-sm" />
          <Button type="submit" variant="outline" disabled={ocupado || !comodo.trim() || !descricao.trim()}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar item
          </Button>
        </form>
      )}

      {parte && !conf?.laudo && (
        <label className="mt-3 block text-sm text-muted">
          Anexar laudo independente (PDF, até 15 MB)
          <input type="file" accept="application/pdf" disabled={ocupado} onChange={(e) => anexarLaudo(e.target.files?.[0])} className="mt-1 block text-sm" data-testid={`conferencia-${tipo}-laudo-input`} />
        </label>
      )}

      {parte && conf && conf.itens.length > 0 && !respondeu && (
        <div className="mt-4 space-y-2">
          {contestando ? (
            <>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} rows={3} placeholder="Conte o motivo da contestação" aria-label="Motivo da contestação" className="w-full rounded-lg border border-line p-3 text-sm" />
              <div className="flex gap-2">
                <Button disabled={ocupado || !motivo.trim()} onClick={() => rodar(() => responderConferencia({ contratoId, tipo, decisao: "contestou", motivo }))}>
                  Enviar contestação
                </Button>
                <Button variant="outline" onClick={() => setContestando(false)}>
                  Voltar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button disabled={ocupado} onClick={() => rodar(() => responderConferencia({ contratoId, tipo, decisao: "confirmou" }))} data-testid={`conferencia-${tipo}-confirmar`}>
                Confirmar
              </Button>
              <Button variant="outline" disabled={ocupado} onClick={() => setContestando(true)}>
                Contestar
              </Button>
              <p className="w-full text-xs text-muted">Depois de confirmar ou contestar, a conferência não pode mais ser alterada.</p>
            </div>
          )}
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-700" data-testid="conferencia-erro">
          {erro}
        </p>
      )}
    </section>
  );
}
