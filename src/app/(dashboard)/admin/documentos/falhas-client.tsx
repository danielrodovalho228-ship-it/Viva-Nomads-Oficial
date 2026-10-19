"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { emitirDeNovo, emitirPendentes, reenviarEmail, type FalhaDocumento } from "@/lib/data/documentos-falhas-actions";
import { dataHoraBrasilia } from "@/config/atendimento";

/**
 * "Documentos com falha" (complemento da jornada de assinatura, 19/10): cada emissão que não saiu, com o motivo e
 * "Emitir de novo"; e o retroativo "Emitir os pendentes" para pagamentos confirmados que ficaram sem recibo.
 */
export function FalhasDocumentos({ falhas, pendentes }: { falhas: FalhaDocumento[]; pendentes: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Panel title="Documentos com falha" className="mt-6" data-testid="documentos-falhas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {pendentes === 0
            ? "Nenhum pagamento confirmado sem recibo."
            : `${pendentes} ${pendentes === 1 ? "pagamento confirmado está" : "pagamentos confirmados estão"} sem recibo.`}
        </p>
        <Button
          size="sm"
          variant="primary"
          disabled={pendentes === 0 || ocupado === "todos"}
          data-testid="documentos-emitir-pendentes"
          onClick={async () => {
            setOcupado("todos");
            setMsg(null);
            const r = await emitirPendentes().catch(() => ({ ok: false as const, error: "Falha de conexão." }));
            setOcupado(null);
            setMsg(r.ok ? `${r.emitidos} emitidos${r.falharam ? `, ${r.falharam} com falha (veja a fila)` : ""}.` : r.error);
            router.refresh();
          }}
        >
          {ocupado === "todos" ? "Emitindo…" : "Emitir os pendentes"}
        </Button>
      </div>
      {msg && (
        <p className="mt-2 text-sm text-ink" role="status" data-testid="documentos-falhas-msg">
          {msg}
        </p>
      )}
      {falhas.length === 0 ? (
        <p className="mt-3 text-sm text-muted" data-testid="documentos-falhas-vazia">Nenhuma emissão ou envio com falha.</p>
      ) : (
        <ul className="mt-3 divide-y divide-sage-100">
          {falhas.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="documento-falha">
              <span className="min-w-0">
                <span className="block font-medium text-ink">
                  <span data-testid="falha-numero">{f.numero ?? "Sem número (não emitido)"}</span> · <span data-testid="falha-tipo">{f.tipo}</span>
                  {f.etapa === "envio" ? " · emitido, e-mail não saiu" : ""}
                </span>
                <span className="block text-xs text-ink">
                  <span data-testid="falha-contrato">{f.contrato}</span> · proprietário{" "}
                  <span data-testid="falha-proprietario">{f.proprietario}</span> · inquilino <span data-testid="falha-inquilino">{f.inquilino}</span>
                </span>
                <span className="block break-words text-xs text-muted">
                  <span data-testid="falha-motivo">{f.motivo}</span> · {f.tentativas} {f.tentativas === 1 ? "tentativa" : "tentativas"} · falhou em{" "}
                  <span data-testid="falha-data">{dataHoraBrasilia(new Date(f.atualizadoEm))}</span>
                </span>
              </span>
              {f.etapa === "envio" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ocupado === f.id}
                  data-testid="documento-reenviar-email"
                  onClick={async () => {
                    setOcupado(f.id);
                    setMsg(null);
                    const r = await reenviarEmail(f.id).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
                    setOcupado(null);
                    setMsg(r.ok ? `E-mail reenviado: ${r.numero} (${r.enviados} de ${r.total} confirmados).` : r.error);
                    router.refresh();
                  }}
                >
                  {ocupado === f.id ? "Enviando…" : "Reenviar e-mail"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ocupado === f.id}
                  data-testid="documento-emitir-de-novo"
                  onClick={async () => {
                    setOcupado(f.id);
                    setMsg(null);
                    const r = await emitirDeNovo(f.id).catch(() => ({ ok: false as const, error: "Falha de conexão." }));
                    setOcupado(null);
                    setMsg(r.ok ? `Emitido: ${r.numero}.` : r.error);
                    router.refresh();
                  }}
                >
                  {ocupado === f.id ? "Emitindo…" : "Emitir de novo"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
