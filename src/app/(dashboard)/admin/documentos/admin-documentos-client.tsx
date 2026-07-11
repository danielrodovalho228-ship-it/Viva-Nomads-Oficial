"use client";

import { useState } from "react";
import { FileText, ExternalLink, Check, X, ShieldCheck } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { moderarDocumento, type DocumentoPendente } from "@/lib/data/documentos-admin";
import { cn } from "@/lib/utils";

/**
 * Fila de moderação dos documentos de imóvel (matrícula / contrato de gestão).
 * Admin abre o documento (URL assinada curta), aprova ou recusa com motivo. Só
 * aprovado libera o proprietário a publicar; e-mail sai nos dois desfechos.
 */
export function AdminDocumentosClient({ docs }: { docs: DocumentoPendente[] }) {
  const [fila, setFila] = useState(docs);
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: string, aprovado: boolean, motivoTexto?: string) {
    setBusy(id);
    setErro(null);
    const res = await moderarDocumento(id, aprovado, motivoTexto);
    setBusy(null);
    if (!res.ok) {
      setErro(res.error ?? "Não foi possível registrar a decisão.");
      return;
    }
    // Sai da fila (aprovado ou recusado).
    setFila((f) => f.filter((d) => d.id !== id));
    setRejeitando(null);
    setMotivo("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Documentos em análise"
        subtitle="Verifique a matrícula ou o contrato de gestão antes de liberar a publicação."
      />

      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}

      {fila.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nada na fila"
          text="Não há documentos aguardando verificação no momento."
        />
      ) : (
        <div className="space-y-3">
          {fila.map((d) => {
            const rejThis = rejeitando === d.id;
            return (
              <Panel key={d.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100">
                      <FileText className="h-5 w-5 text-forest" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{d.ownerNome}</p>
                      <p className="text-xs text-muted">
                        Enviado{" "}
                        {d.criadoEm ? new Date(d.criadoEm).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                  </div>
                  {d.docUrl ? (
                    <a
                      href={d.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 px-3 py-1.5 text-sm font-medium text-forest hover:border-sage"
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir documento
                    </a>
                  ) : (
                    <span className="text-xs text-muted">documento indisponível</span>
                  )}
                </div>

                {rejThis ? (
                  <div className="mt-4 border-t border-sage-200 pt-4">
                    <label className="text-sm font-medium text-ink">Motivo da recusa</label>
                    <textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={2}
                      placeholder="Ex.: documento ilegível / não corresponde ao imóvel / vencido."
                      className="input mt-2"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRejeitando(null);
                          setMotivo("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        disabled={busy === d.id || motivo.trim().length === 0}
                        onClick={() => decidir(d.id, false, motivo)}
                      >
                        Confirmar recusa
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex justify-end gap-2 border-t border-sage-200 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("border-red-200 text-red-600 hover:bg-red-50")}
                      disabled={busy === d.id}
                      onClick={() => setRejeitando(d.id)}
                    >
                      <X className="h-4 w-4" /> Recusar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy === d.id}
                      onClick={() => decidir(d.id, true)}
                    >
                      <Check className="h-4 w-4" /> {busy === d.id ? "Salvando…" : "Aprovar"}
                    </Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
