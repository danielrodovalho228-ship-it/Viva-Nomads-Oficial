"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { AVISO_REENVIO, type FiltrosEmitidos } from "@/lib/fiscal/emitidos";
import { reenviarEmitido, type DocumentoEmitido } from "@/lib/data/emitidos-actions";

const campo = "h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink";

/**
 * L2-B item 14 — aba "Emitidos": documentos do registro com número, tipo, destinatário mascarado, data e status do
 * envio; filtros por tipo e período (na URL); "Reenviar e-mail" pede confirmação e manda o MESMO documento.
 */
export function EmitidosAdmin({ itens, filtros, tipos }: { itens: DocumentoEmitido[]; filtros: FiltrosEmitidos; tipos: { valor: string; rotulo: string }[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Panel title="Documentos emitidos" className="mt-6" data-testid="documentos-emitidos">
      <form method="get" className="flex flex-wrap items-end gap-3" data-testid="emitidos-filtros">
        <input type="hidden" name="aba" value="emitidos" />
        <label className="grid gap-1 text-xs text-muted">
          Tipo
          <select name="tipo" defaultValue={filtros.tipo ?? ""} className={campo} data-testid="emitidos-tipo">
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.valor} · {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          De
          <input type="date" name="de" defaultValue={filtros.de ?? ""} className={campo} data-testid="emitidos-de" />
        </label>
        <label className="grid gap-1 text-xs text-muted">
          Até
          <input type="date" name="ate" defaultValue={filtros.ate ?? ""} className={campo} data-testid="emitidos-ate" />
        </label>
        <Button type="submit" size="sm" variant="secondary" data-testid="emitidos-filtrar">
          Filtrar
        </Button>
      </form>
      {msg && (
        <p className="mt-3 text-sm text-ink" role="status" data-testid="emitidos-msg">
          {msg}
        </p>
      )}
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-muted" data-testid="emitidos-vazio">
          Nenhum documento emitido com estes filtros.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-sage-100">
          {itens.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm" data-testid="emitido" data-prefixo={d.prefixo}>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">
                  <span data-testid="emitido-numero">{d.numero}</span>
                  {d.versao > 1 ? ` · versão ${d.versao}` : ""} · {d.tipoRotulo}
                  {d.status !== "valido" ? ` · ${d.status}` : ""}
                  {d.teste ? " · teste" : ""}
                </span>
                <span className="block text-xs text-muted">
                  {dataHoraBRT(d.emitidoEm)} · para <span data-testid="emitido-destinatarios">{d.destinatarios.join(", ") || "—"}</span>
                </span>
                <span className="block text-xs text-ink" data-testid="emitido-envio" data-chave={d.envio.chave}>
                  {d.envio.rotulo}
                  {d.reenvios ? ` · reenviado ${d.reenvios}×` : ""}
                </span>
              </span>
              {d.envio.podeReenviar && (
                <ConfirmarNaPagina
                  aviso={AVISO_REENVIO}
                  confirmar="Reenviar"
                  size="sm"
                  disabled={ocupado === d.id}
                  testid="emitido-reenviar"
                  onConfirmar={async () => {
                    setOcupado(d.id);
                    setMsg(null);
                    const r = await reenviarEmitido(d.id).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
                    setOcupado(null);
                    setMsg(r.ok ? `${r.numero}: e-mail reenviado a ${r.enviados} de ${r.total}.` : r.error);
                    router.refresh();
                  }}
                >
                  {ocupado === d.id ? "Reenviando…" : "Reenviar e-mail"}
                </ConfirmarNaPagina>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
