"use client";

import { useState } from "react";
import {
  FileText,
  ExternalLink,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  User,
  Home,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { moderarDocumento, type DocumentoPendente } from "@/lib/data/documentos-admin";
import {
  CHECKLIST_CONFERENCIA,
  MOTIVOS_RECUSA,
  conferenciaCompleta,
  comporMotivoRecusa,
} from "@/lib/moderacao-doc";
import { cn } from "@/lib/utils";

/**
 * Fila de CONFERÊNCIA dos documentos de imóvel (matrícula / contrato de gestão).
 * O admin vê o documento inline, compara nome/imóvel com o cadastro, marca o
 * checklist de conferência e só então aprova; recusa exige motivo estruturado.
 * Só aprovado libera o proprietário a publicar; e-mail sai nos dois desfechos.
 *
 * Nota (jurídico): conferimos o DOCUMENTO — não atestamos propriedade. Ver a
 * regra de vocabulário em scripts/check-consistency.mjs.
 */
export function AdminDocumentosClient({ docs }: { docs: DocumentoPendente[] }) {
  const [fila, setFila] = useState(docs);

  function sair(id: string) {
    setFila((f) => f.filter((d) => d.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Documentos em conferência"
        subtitle="Confira a matrícula ou o contrato de gestão antes de liberar a publicação. Conferimos o documento — não atestamos a propriedade."
      />

      {fila.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nada na fila"
          text="Não há documentos aguardando conferência no momento."
        />
      ) : (
        <div className="space-y-4">
          {fila.map((d) => (
            <DocCard key={d.id} doc={d} onDone={() => sair(d.id)} />
          ))}
        </div>
      )}

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-sage-200);background:#fff;padding:0.625rem 0.875rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-sage)}`}</style>
    </div>
  );
}

function DocCard({ doc, onDone }: { doc: DocumentoPendente; onDone: () => void }) {
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeAprovar = conferenciaCompleta(marks);
  const motivoFinal = comporMotivoRecusa(motivo, detalhe);

  async function aprovar() {
    setBusy(true);
    setErro(null);
    const res = await moderarDocumento(doc.id, true);
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível registrar a decisão.");
    onDone();
  }

  async function recusar() {
    if (!motivoFinal) return setErro("Escolha o motivo (e descreva, se for 'Outro').");
    setBusy(true);
    setErro(null);
    const res = await moderarDocumento(doc.id, false, motivoFinal);
    setBusy(false);
    if (!res.ok) return setErro(res.error ?? "Não foi possível registrar a decisão.");
    onDone();
  }

  return (
    <Panel>
      {/* Cabeçalho: dono + data */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-100">
          <FileText className="h-5 w-5 text-forest" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink">{doc.ownerNome}</p>
          <p className="text-xs text-muted">
            Enviado {doc.criadoEm ? new Date(doc.criadoEm).toLocaleDateString("pt-BR") : "—"}
          </p>
        </div>
      </div>

      {/* Alerta de arquivo reutilizado (anti-fraude) */}
      {doc.duplicado > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Arquivo idêntico já enviado em {doc.duplicado} outro(s) cadastro(s).</strong>{" "}
            Confira se não é reuso indevido de documento antes de aprovar.
          </span>
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Visualizador inline do documento */}
        <div className="rounded-xl border border-sage-200 bg-surface-2 p-2">
          {doc.docUrl ? (
            doc.docTipo === "imagem" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doc.docUrl}
                alt="Documento do imóvel para conferência"
                className="max-h-80 w-full rounded-lg object-contain"
              />
            ) : doc.docTipo === "pdf" ? (
              <iframe
                src={doc.docUrl}
                title="Documento do imóvel (PDF)"
                className="h-80 w-full rounded-lg bg-white"
              />
            ) : (
              <p className="p-4 text-sm text-muted">Pré-visualização indisponível para este tipo.</p>
            )
          ) : (
            <p className="p-4 text-sm text-muted">Documento indisponível.</p>
          )}
          {doc.docUrl && (
            <a
              href={doc.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-forest hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba (tamanho real)
            </a>
          )}
        </div>

        {/* Comparação + checklist de conferência */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Confira contra o cadastro
          </p>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
              <div className="min-w-0">
                <dt className="text-xs text-muted">Titular da conta</dt>
                <dd className="font-medium text-ink">{doc.ownerNomeCompleto ?? doc.ownerNome}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Home className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
              <div className="min-w-0">
                <dt className="text-xs text-muted">Imóvel do cadastro</dt>
                <dd className="font-medium text-ink">
                  {doc.refImovel ?? "— (sem imóvel cadastrado ainda)"}
                </dd>
              </div>
            </div>
          </dl>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Checklist de conferência
          </p>
          <div className="mt-2 space-y-1.5">
            {CHECKLIST_CONFERENCIA.map((item) => (
              <label key={item.key} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={!!marks[item.key]}
                  onChange={(e) => setMarks((m) => ({ ...m, [item.key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-sage-200 accent-forest"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      {rejeitando ? (
        <div className="mt-4 border-t border-sage-200 pt-4">
          <label className="text-sm font-medium text-ink">Motivo da recusa</label>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input mt-2">
            <option value="">Selecione um motivo…</option>
            {MOTIVOS_RECUSA.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <textarea
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            rows={2}
            placeholder={
              motivo === "outro"
                ? "Descreva o motivo (obrigatório)."
                : "Detalhe opcional para o proprietário."
            }
            className="input mt-2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRejeitando(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              disabled={busy || !motivoFinal}
              onClick={recusar}
            >
              {busy ? "Salvando…" : "Confirmar recusa"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-sage-200 pt-4">
          {!podeAprovar && (
            <span className="mr-auto text-xs text-muted">
              Marque todos os itens do checklist para aprovar.
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn("border-red-200 text-red-600 hover:bg-red-50")}
            disabled={busy}
            onClick={() => setRejeitando(true)}
          >
            <X className="h-4 w-4" /> Recusar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !podeAprovar}
            title={podeAprovar ? undefined : "Conclua o checklist de conferência"}
            onClick={aprovar}
          >
            <Check className="h-4 w-4" /> {busy ? "Salvando…" : "Aprovar"}
          </Button>
        </div>
      )}
    </Panel>
  );
}
